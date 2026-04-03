import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import type { AidlDefinition, AidlSdkConfig, AidlCompileResult } from '../shared/types';

const getConfigPath = () => path.join(app.getPath('userData'), 'aidl-config.json');
const getBuildDir = () => path.join(app.getPath('userData'), 'aidl_build');

export async function loadAidlConfig(): Promise<AidlSdkConfig> {
  try {
    const data = await fs.readFile(getConfigPath(), 'utf-8');
    return JSON.parse(data) as AidlSdkConfig;
  } catch {
    return {
      sdkPath: '',
      buildToolsVersion: '34.0.0',
      platformVersion: 'android-34',
    };
  }
}

export async function saveAidlConfig(config: AidlSdkConfig): Promise<void> {
  await fs.writeFile(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

async function runCommand(cmd: string, args: string[], options: { cwd?: string, shell?: boolean } = {}): Promise<{ output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: options.shell || false, cwd: options.cwd });
    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || output || `Command failed with code ${code}`));
      } else {
        resolve({ output: output + errorOutput });
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

function generateAidlContent(definition: AidlDefinition): string {
  let content = `package ${definition.packageName};\n\n`;
  content += `interface ${definition.interfaceName} {\n`;
  
  for (const method of definition.methods) {
    const paramsString = method.params.map(p => `${p.type} ${p.name}`).join(', ');
    content += `    ${method.returnType} ${method.name}(${paramsString});\n`;
  }
  
  content += `}\n`;
  return content;
}

export async function compileAidl(sdkConfig: AidlSdkConfig, definition: AidlDefinition): Promise<AidlCompileResult> {
  const buildDir = getBuildDir();
  const aidlDir = path.join(buildDir, 'aidl', ...definition.packageName.split('.'));
  const javaDir = path.join(buildDir, 'java');
  const classesDir = path.join(buildDir, 'classes');
  const outJarPath = path.join(buildDir, `${definition.interfaceName}.jar`);
  
  const aidlFilePath = path.join(aidlDir, `${definition.interfaceName}.aidl`);
  const javaFilePath = path.join(javaDir, ...definition.packageName.split('.'), `${definition.interfaceName}.java`);
  const javaFileStubPath = path.join(javaDir, ...definition.packageName.split('.'), `${definition.interfaceName}$Stub.java`); // Though usually multiple files might not be there or might be a single nested class.

  try {
    // 1. Prepare directories
    await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(aidlDir, { recursive: true });
    await fs.mkdir(javaDir, { recursive: true });
    await fs.mkdir(classesDir, { recursive: true });

    // 2. Generate .aidl file
    const aidlContent = generateAidlContent(definition);
    await fs.writeFile(aidlFilePath, aidlContent, 'utf-8');

    // 3. Run AIDL compiler
    const isWindows = process.platform === 'win32';
    const aidlBin = isWindows ? 'aidl.exe' : 'aidl';
    const aidlCmd = path.join(sdkConfig.sdkPath, 'build-tools', sdkConfig.buildToolsVersion, aidlBin);
    const frameworkAidl = path.join(sdkConfig.sdkPath, 'platforms', sdkConfig.platformVersion, 'framework.aidl');

    try {
      await runCommand(aidlCmd, [
        `-p${frameworkAidl}`,
        `-o${javaDir}`,
        aidlFilePath
      ]);
    } catch (e) {
      return { success: false, stage: 'aidl', error: String(e) };
    }

    // 4. Run javac
    const androidJar = path.join(sdkConfig.sdkPath, 'platforms', sdkConfig.platformVersion, 'android.jar');
    
    // Find all generated java files
    // aidl generates the Interface and optionally a Stub class within it, or a separate file depending on version.
    // It's safer to just compile all java files in the output directory.
    const javaFiles: string[] = [];
    async function collectJavaFiles(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await collectJavaFiles(fullPath);
        } else if (entry.name.endsWith('.java')) {
          javaFiles.push(fullPath);
        }
      }
    }
    await collectJavaFiles(javaDir);

    try {
      await runCommand('javac', [
        '-source', '1.8',
        '-target', '1.8',
        '-cp', androidJar,
        '-d', classesDir,
        ...javaFiles
      ]);
    } catch (e) {
      return { success: false, stage: 'javac', error: String(e) };
    }

    // 5. Run d8 dexer
    // Collect all class files
    const classFiles: string[] = [];
    async function collectClassFiles(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await collectClassFiles(fullPath);
        } else if (entry.name.endsWith('.class')) {
          classFiles.push(fullPath);
        }
      }
    }
    await collectClassFiles(classesDir);

    const d8Bin = isWindows ? 'd8.bat' : 'd8';
    const d8Cmd = path.join(sdkConfig.sdkPath, 'build-tools', sdkConfig.buildToolsVersion, d8Bin);

    try {
      await runCommand(d8Cmd, [
        '--output', outJarPath,
        '--lib', androidJar,
        ...classFiles
      ], { shell: isWindows }); // d8.bat requires shell on Windows
    } catch (e) {
      return { success: false, stage: 'd8', error: String(e) };
    }

    return {
      success: true,
      jarPath: outJarPath
    };
  } catch (e) {
    return { success: false, stage: 'general', error: String(e) };
  }
}
