package com.intentpostman.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.intentpostman.service.CommandService

/**
 * Headless launcher activity.
 * Starts the CommandService foreground service and stays alive but invisible
 * (translucent theme). Does NOT finish() because Android restricts background
 * activity launches — the app must remain in the task stack so the service
 * can start activities.
 *
 * Also requests SYSTEM_ALERT_WINDOW (draw over other apps) so activities
 * launched by the service can appear even when another app is in foreground.
 */
class MainActivity : ComponentActivity() {

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        // After notification permission result, request overlay permission
        requestOverlayPermission()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request notification permission for Android 13+ (needed for foreground service notification)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            requestOverlayPermission()
        }
    }

    private fun requestOverlayPermission() {
        // Request SYSTEM_ALERT_WINDOW if not already granted
        if (!Settings.canDrawOverlays(this)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
        }

        startServer()
    }

    private fun startServer() {
        val intent = Intent(this, CommandService::class.java).apply {
            action = CommandService.ACTION_START
            putExtra(CommandService.EXTRA_PORT, CommandService.DEFAULT_PORT)
        }
        startForegroundService(intent)
//
//        // Move task to back — activity stays alive but user sees their previous app
//        moveTaskToBack(true)
    }
}
