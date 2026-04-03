package com.intentpostman.handlers

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intentpostman.server.JsonRpcException
import com.intentpostman.server.JsonRpcNotification
import dalvik.system.DexClassLoader
import java.io.File
import java.lang.reflect.Method

class AidlHandler(
    private val context: Context,
    private val pushNotification: (JsonRpcNotification) -> Unit
) {
    companion object {
        private const val TAG = "AidlHandler"
    }

    data class LoadedInterface(
        val interfaceId: String,
        val packageName: String,
        val interfaceName: String,
        val stubClass: Class<*>,
        val interfaceClass: Class<*>,
        val methods: List<MethodInfo>,
        val jarPath: String
    )

    data class AidlBindingInfo(
        val bindingId: String,
        val interfaceId: String,
        val connection: ServiceConnection,
        val component: String,
        var proxy: Any? = null,
        var connected: Boolean = false,
        var methods: List<MethodInfo> = emptyList()
    )

    data class MethodInfo(
        val name: String,
        val returnType: String,
        val paramTypes: List<String>
    )

    private val loadedInterfaces = mutableMapOf<String, LoadedInterface>()
    private val aidlBindings = mutableMapOf<String, AidlBindingInfo>()

    // ── aidl.load ────────────────────────────────────────────────
    fun loadInterface(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val jarPath = params.get("jarPath")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'jarPath'")
        val packageName = params.get("packageName")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'packageName'")
        val interfaceName = params.get("interfaceName")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'interfaceName'")

        try {
            // Copy JAR to app cache for DexClassLoader (needs writable dir)
            val srcFile = File(jarPath)
            if (!srcFile.exists()) {
                throw JsonRpcException(-1003, "JAR not found at: $jarPath")
            }

            val cacheDir = File(context.cacheDir, "aidl_dex")
            cacheDir.mkdirs()
            val localJar = File(cacheDir, srcFile.name)
            srcFile.copyTo(localJar, overwrite = true)

            val optimizedDir = File(cacheDir, "opt")
            optimizedDir.mkdirs()

            val classLoader = DexClassLoader(
                localJar.absolutePath,
                optimizedDir.absolutePath,
                null,
                context.classLoader
            )

            // Load the Stub class (e.g. com.example.ITest$Stub)
            val fqInterface = "$packageName.$interfaceName"
            val stubClassName = "$fqInterface\$Stub"

            val stubClass = try {
                classLoader.loadClass(stubClassName)
            } catch (e: ClassNotFoundException) {
                throw JsonRpcException(-1003, "Stub class not found: $stubClassName. " +
                    "Make sure the AIDL was compiled correctly.")
            }

            // Load the interface class
            val interfaceClass = try {
                classLoader.loadClass(fqInterface)
            } catch (e: ClassNotFoundException) {
                throw JsonRpcException(-1003, "Interface class not found: $fqInterface")
            }

            // Discover methods from the interface
            val methods = discoverAidlMethods(interfaceClass)
            val interfaceId = java.util.UUID.randomUUID().toString()

            loadedInterfaces[interfaceId] = LoadedInterface(
                interfaceId = interfaceId,
                packageName = packageName,
                interfaceName = interfaceName,
                stubClass = stubClass,
                interfaceClass = interfaceClass,
                methods = methods,
                jarPath = localJar.absolutePath
            )

            Log.d(TAG, "Loaded AIDL interface: $fqInterface with ${methods.size} methods")

            return JsonObject().apply {
                addProperty("interfaceId", interfaceId)
                addProperty("packageName", packageName)
                addProperty("interfaceName", interfaceName)
                add("methods", methodsToJson(methods))
            }
        } catch (e: JsonRpcException) {
            throw e
        } catch (e: Exception) {
            throw JsonRpcException(-1003, "Failed to load AIDL interface: ${e.message}")
        }
    }

    // ── aidl.bind ────────────────────────────────────────────────
    fun bindService(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val interfaceId = params.get("interfaceId")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'interfaceId'")
        val component = params.get("component")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'component'")

        val loaded = loadedInterfaces[interfaceId]
            ?: throw JsonRpcException(-1003, "No loaded interface: $interfaceId")

        val bindingId = java.util.UUID.randomUUID().toString()

        val connection = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName, binder: IBinder) {
                Log.d(TAG, "AIDL service connected: $name")
                try {
                    // Call Stub.asInterface(binder) via reflection
                    val asInterfaceMethod = loaded.stubClass.getMethod("asInterface", IBinder::class.java)
                    val proxy = asInterfaceMethod.invoke(null, binder)

                    val binding = aidlBindings[bindingId]
                    if (binding != null) {
                        binding.proxy = proxy
                        binding.connected = true

                        // Discover methods from the proxy
                        val proxyMethods = if (proxy != null) {
                            discoverAidlMethods(loaded.interfaceClass)
                        } else {
                            emptyList()
                        }
                        binding.methods = proxyMethods

                        pushNotification(JsonRpcNotification(
                            method = "aidl.connected",
                            params = JsonObject().apply {
                                addProperty("bindingId", bindingId)
                                addProperty("interfaceId", interfaceId)
                                addProperty("component", name.flattenToString())
                                addProperty("proxyClass", proxy?.javaClass?.name ?: "null")
                                add("methods", methodsToJson(proxyMethods))
                            }
                        ))
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to create AIDL proxy: ${e.message}", e)
                    pushNotification(JsonRpcNotification(
                        method = "aidl.connected",
                        params = JsonObject().apply {
                            addProperty("bindingId", bindingId)
                            addProperty("error", "Failed to create proxy: ${e.message}")
                        }
                    ))
                }
            }

            override fun onServiceDisconnected(name: ComponentName) {
                Log.d(TAG, "AIDL service disconnected: $name")
                aidlBindings[bindingId]?.connected = false
                aidlBindings[bindingId]?.proxy = null

                pushNotification(JsonRpcNotification(
                    method = "aidl.disconnected",
                    params = JsonObject().apply {
                        addProperty("bindingId", bindingId)
                        addProperty("interfaceId", interfaceId)
                        addProperty("component", name.flattenToString())
                    }
                ))
            }
        }

        // Build service intent from component
        val intent = Intent()
        val parts = component.split("/")
        if (parts.size == 2) {
            val pkg = parts[0]
            val cls = if (parts[1].startsWith(".")) pkg + parts[1] else parts[1]
            intent.component = ComponentName(pkg, cls)
        } else {
            throw JsonRpcException(-32602, "Invalid component format: $component (expected 'pkg/cls')")
        }

        try {
            val bound = context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
            if (!bound) {
                throw JsonRpcException(-1003, "bindService returned false — service not found or permission denied")
            }

            aidlBindings[bindingId] = AidlBindingInfo(
                bindingId = bindingId,
                interfaceId = interfaceId,
                connection = connection,
                component = component
            )

            return JsonObject().apply {
                addProperty("status", "binding")
                addProperty("bindingId", bindingId)
                addProperty("interfaceId", interfaceId)
                addProperty("component", component)
                addProperty("message", "Waiting for AIDL service connection. Result will arrive as 'aidl.connected' notification.")
            }
        } catch (e: JsonRpcException) {
            throw e
        } catch (e: Exception) {
            throw JsonRpcException(-1003, "Failed to bind AIDL service: ${e.message}")
        }
    }

    // ── aidl.call ────────────────────────────────────────────────
    fun callMethod(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val bindingId = params.get("bindingId")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'bindingId'")
        val methodName = params.get("method")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'method'")

        val binding = aidlBindings[bindingId]
            ?: throw JsonRpcException(-1003, "No AIDL binding: $bindingId")

        if (!binding.connected || binding.proxy == null) {
            throw JsonRpcException(-1003, "AIDL service not connected")
        }

        val proxy = binding.proxy!!
        val loaded = loadedInterfaces[binding.interfaceId]
            ?: throw JsonRpcException(-1003, "Interface no longer loaded: ${binding.interfaceId}")

        try {
            // Find the method on the interface class to get correct parameter types
            val method = findMethodByName(loaded.interfaceClass, methodName)
                ?: findMethodByName(proxy.javaClass, methodName)
                ?: throw JsonRpcException(-1003, "Method '$methodName' not found on AIDL proxy")

            val args = buildMethodArgs(method, params.getAsJsonArray("args"))
            method.isAccessible = true
            val result = method.invoke(proxy, *args)

            return JsonObject().apply {
                addProperty("status", "success")
                addProperty("method", methodName)
                if (result != null) {
                    addProperty("result", result.toString())
                    addProperty("resultType", result.javaClass.simpleName)
                } else {
                    addProperty("result", "void")
                    addProperty("resultType", "void")
                }
            }
        } catch (e: JsonRpcException) {
            throw e
        } catch (e: java.lang.reflect.InvocationTargetException) {
            val cause = e.cause ?: e
            throw JsonRpcException(-1003, "AIDL method invocation failed: ${cause.message}")
        } catch (e: Exception) {
            throw JsonRpcException(-1003, "AIDL call failed: ${e.message}")
        }
    }

    // ── aidl.listLoaded ──────────────────────────────────────────
    fun listLoaded(params: JsonObject?): JsonElement {
        val arr = JsonArray()
        for ((_, loaded) in loadedInterfaces) {
            arr.add(JsonObject().apply {
                addProperty("interfaceId", loaded.interfaceId)
                addProperty("packageName", loaded.packageName)
                addProperty("interfaceName", loaded.interfaceName)
                addProperty("jarPath", loaded.jarPath)
                add("methods", methodsToJson(loaded.methods))
            })
        }
        return JsonObject().apply {
            addProperty("count", loadedInterfaces.size)
            add("interfaces", arr)
        }
    }

    // ── aidl.unload ──────────────────────────────────────────────
    fun unloadInterface(params: JsonObject?): JsonElement {
        val interfaceId = params?.get("interfaceId")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'interfaceId'")

        // Unbind any associated AIDL bindings
        val toRemove = aidlBindings.filter { it.value.interfaceId == interfaceId }
        for ((id, info) in toRemove) {
            try { context.unbindService(info.connection) } catch (_: Exception) {}
            aidlBindings.remove(id)
        }

        loadedInterfaces.remove(interfaceId)
            ?: throw JsonRpcException(-1003, "No loaded interface: $interfaceId")

        return JsonObject().apply {
            addProperty("status", "unloaded")
            addProperty("interfaceId", interfaceId)
        }
    }

    // ── aidl.unbind ──────────────────────────────────────────────
    fun unbindService(params: JsonObject?): JsonElement {
        val bindingId = params?.get("bindingId")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'bindingId'")

        val info = aidlBindings.remove(bindingId)
            ?: throw JsonRpcException(-1003, "No AIDL binding: $bindingId")

        try { context.unbindService(info.connection) } catch (_: Exception) {}

        return JsonObject().apply {
            addProperty("status", "unbound")
            addProperty("bindingId", bindingId)
        }
    }

    // ── Cleanup ──────────────────────────────────────────────────
    fun cleanup() {
        for ((_, info) in aidlBindings) {
            try { context.unbindService(info.connection) } catch (_: Exception) {}
        }
        aidlBindings.clear()
        loadedInterfaces.clear()
    }

    // ── Helpers ──────────────────────────────────────────────────

    private val filteredMethodNames = setOf(
        "asBinder", "asInterface",
        "toString", "hashCode", "equals", "getClass",
        "notify", "notifyAll", "wait",
        "getInterfaceDescriptor"
    )

    private fun discoverAidlMethods(interfaceClass: Class<*>): List<MethodInfo> {
        return interfaceClass.declaredMethods
            .filter { m ->
                m.name !in filteredMethodNames &&
                !m.name.startsWith("$") &&
                !m.name.contains("$")
            }
            .map { m ->
                MethodInfo(
                    name = m.name,
                    returnType = m.returnType.simpleName,
                    paramTypes = m.parameterTypes.map { it.simpleName }
                )
            }
    }

    private fun findMethodByName(clazz: Class<*>, name: String): Method? {
        return clazz.declaredMethods.firstOrNull { it.name == name }
            ?: clazz.methods.firstOrNull { it.name == name }
    }

    private fun buildMethodArgs(method: Method, argsArray: com.google.gson.JsonArray?): Array<Any?> {
        if (argsArray == null || argsArray.size() == 0) return emptyArray()

        val paramTypes = method.parameterTypes
        val args = Array<Any?>(paramTypes.size) { null }

        for (i in paramTypes.indices) {
            if (i >= argsArray.size()) break
            val arg = argsArray[i]
            args[i] = when (paramTypes[i]) {
                String::class.java -> arg.asString
                Int::class.java, Integer::class.java -> arg.asInt
                Long::class.java, java.lang.Long::class.java -> arg.asLong
                Float::class.java, java.lang.Float::class.java -> arg.asFloat
                Double::class.java, java.lang.Double::class.java -> arg.asDouble
                Boolean::class.java, java.lang.Boolean::class.java -> arg.asBoolean
                else -> arg.asString
            }
        }

        return args
    }

    private fun methodsToJson(methods: List<MethodInfo>): JsonArray {
        val arr = JsonArray()
        for (m in methods) {
            arr.add(JsonObject().apply {
                addProperty("name", m.name)
                addProperty("returnType", m.returnType)
                val paramsArr = JsonArray()
                for (p in m.paramTypes) paramsArr.add(p)
                add("paramTypes", paramsArr)
            })
        }
        return arr
    }
}
