package com.intentpostman.ui

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.intentpostman.server.CommandServer
import com.intentpostman.service.CommandService

class MainActivity : ComponentActivity() {

    private var commandService: CommandService? = null
    private var bound = false

    private val serverStatus = mutableStateOf(CommandServer.ServerStatus.STOPPED)
    private val clientCount = mutableIntStateOf(0)
    private val logs = mutableStateListOf<String>()

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as CommandService.LocalBinder
            commandService = binder.getService()
            bound = true

            commandService?.onStatusChange = { status, clients ->
                runOnUiThread {
                    serverStatus.value = status
                    clientCount.intValue = clients
                    addLog("Status: $status, Clients: $clients")
                }
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            commandService = null
            bound = false
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* proceed regardless */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request notification permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        setContent {
            IntentPostmanTheme {
                MainScreen(
                    serverStatus = serverStatus.value,
                    clientCount = clientCount.intValue,
                    logs = logs,
                    onStart = { port -> startServer(port) },
                    onStop = { stopServer() }
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        Intent(this, CommandService::class.java).also { intent ->
            bindService(intent, connection, Context.BIND_AUTO_CREATE)
        }
    }

    override fun onStop() {
        super.onStop()
        if (bound) {
            unbindService(connection)
            bound = false
        }
    }

    private fun startServer(port: Int) {
        addLog("Starting server on port $port...")
        val intent = Intent(this, CommandService::class.java).apply {
            action = CommandService.ACTION_START
            putExtra(CommandService.EXTRA_PORT, port)
        }
        startForegroundService(intent)
    }

    private fun stopServer() {
        addLog("Stopping server...")
        val intent = Intent(this, CommandService::class.java).apply {
            action = CommandService.ACTION_STOP
        }
        startService(intent)
        serverStatus.value = CommandServer.ServerStatus.STOPPED
        clientCount.intValue = 0
    }

    private fun addLog(message: String) {
        val timestamp = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault())
            .format(java.util.Date())
        logs.add(0, "[$timestamp] $message")
        if (logs.size > 200) logs.removeLast()
    }
}

// ── Theme ─────────────────────────────────────────────────────

val DarkBackground = Color(0xFF1A1A2E)
val DarkSurface = Color(0xFF16213E)
val Accent = Color(0xFFE94560)
val AccentDark = Color(0xFF0F3460)
val TextPrimary = Color(0xFFE0E0E0)
val TextSecondary = Color(0xFF888888)

@Composable
fun IntentPostmanTheme(content: @Composable () -> Unit) {
    val colorScheme = darkColorScheme(
        primary = Accent,
        background = DarkBackground,
        surface = DarkSurface,
        onPrimary = Color.White,
        onBackground = TextPrimary,
        onSurface = TextPrimary,
    )
    MaterialTheme(colorScheme = colorScheme, content = content)
}

// ── Main Screen ───────────────────────────────────────────────

@Composable
fun MainScreen(
    serverStatus: CommandServer.ServerStatus,
    clientCount: Int,
    logs: List<String>,
    onStart: (Int) -> Unit,
    onStop: () -> Unit
) {
    var portText by remember { mutableStateOf("5000") }
    val isRunning = serverStatus == CommandServer.ServerStatus.RUNNING

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(20.dp)
    ) {
        // Header
        Text(
            text = "Intent Postman",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = Accent
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Android Command Server",
            fontSize = 14.sp,
            color = TextSecondary
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Status Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(
                                when (serverStatus) {
                                    CommandServer.ServerStatus.RUNNING -> Color(0xFF4CAF50)
                                    CommandServer.ServerStatus.ERROR -> Color(0xFFF44336)
                                    CommandServer.ServerStatus.STOPPED -> Color(0xFF666666)
                                }
                            )
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = when (serverStatus) {
                            CommandServer.ServerStatus.RUNNING -> "Server Running"
                            CommandServer.ServerStatus.ERROR -> "Server Error"
                            CommandServer.ServerStatus.STOPPED -> "Server Stopped"
                        },
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                }

                if (isRunning) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Port: ${portText}  |  Clients: $clientCount",
                        fontSize = 13.sp,
                        color = TextSecondary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Port Input
        OutlinedTextField(
            value = portText,
            onValueChange = { portText = it.filter { c -> c.isDigit() } },
            label = { Text("Port") },
            enabled = !isRunning,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Accent,
                unfocusedBorderColor = AccentDark,
                focusedLabelColor = Accent,
            )
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Start/Stop Button
        Button(
            onClick = {
                if (isRunning) {
                    onStop()
                } else {
                    val port = portText.toIntOrNull() ?: 5000
                    onStart(port)
                }
            },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (isRunning) Color(0xFF444444) else Accent
            )
        ) {
            Text(
                text = if (isRunning) "Stop Server" else "Start Server",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Logs
        Text(
            text = "LOGS",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = TextSecondary,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(8.dp))

        Card(
            modifier = Modifier.fillMaxWidth().weight(1f),
            shape = RoundedCornerShape(8.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0D1117))
        ) {
            if (logs.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No logs yet. Start the server to begin.",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(logs) { log ->
                        Text(
                            text = log,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            color = TextSecondary
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Instructions
        Text(
            text = "Connect via USB and run: adb forward tcp:5000 tcp:5000",
            fontSize = 11.sp,
            color = TextSecondary,
            fontFamily = FontFamily.Monospace
        )
    }
}
