package com.intentpostman.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.intentpostman.server.CommandServer
import com.intentpostman.ui.MainActivity

class CommandService : Service() {

    companion object {
        private const val CHANNEL_ID = "intent_postman_server"
        private const val NOTIFICATION_ID = 1
        const val DEFAULT_PORT = 5000

        const val ACTION_START = "com.intentpostman.action.START"
        const val ACTION_STOP = "com.intentpostman.action.STOP"
        const val EXTRA_PORT = "port"
    }

    private var server: CommandServer? = null
    private val binder = LocalBinder()

    var onStatusChange: ((CommandServer.ServerStatus, Int) -> Unit)? = null

    inner class LocalBinder : Binder() {
        fun getService(): CommandService = this@CommandService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopServer()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val port = intent?.getIntExtra(EXTRA_PORT, DEFAULT_PORT) ?: DEFAULT_PORT

                // startForeground must be called within 5s of startForegroundService()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(
                        NOTIFICATION_ID,
                        buildNotification(port),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    )
                } else {
                    startForeground(NOTIFICATION_ID, buildNotification(port))
                }

                startServer(port)
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopServer()
        super.onDestroy()
    }

    fun getServer(): CommandServer? = server

    private fun startServer(port: Int) {
        // Don't restart if already running — avoids killing active TCP connections
        if (server != null) return

        server = CommandServer(applicationContext, port).apply {
            onStatusChange = { status ->
                this@CommandService.onStatusChange?.invoke(status, connectedClients)
            }
            start()
        }
    }

    private fun stopServer() {
        server?.stop()
        server = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Intent Postman Server",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when the Intent Postman server is running"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(port: Int): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Intent Postman")
            .setContentText("Server running on port $port")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
