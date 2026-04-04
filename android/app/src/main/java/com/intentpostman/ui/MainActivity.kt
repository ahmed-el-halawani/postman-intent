package com.intentpostman.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.intentpostman.service.CommandService
import com.intentpostman.service.FloatingIndicatorService

/**
 * Transparent, click-through launcher activity that stays in the foreground.
 * - Touches pass through to whatever app is below
 * - Starts CommandService (TCP server) and FloatingIndicatorService (overlay badge)
 * - Requests POST_NOTIFICATIONS and SYSTEM_ALERT_WINDOW permissions
 * - Stays alive so the service can launch activities without background restrictions
 * - onNewIntent handles re-launches via ADB without re-triggering server start
 */
class MainActivity : ComponentActivity() {

    private  val TAG = "MainActivity"
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        checkOverlayAndStart()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.e(TAG, "onCreate: mainactivity" )

        // Make this activity fully click-through — touches pass to apps below
        window.setFlags(
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        )

        // Request notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            checkOverlayAndStart()
        }
    }


    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Re-launched via ADB am start --activity-single-top.
        // Don't re-request permissions or restart services — they're already running.
    }

    private fun checkOverlayAndStart() {
        // Request SYSTEM_ALERT_WINDOW if not granted
        if (!Settings.canDrawOverlays(this)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
        }

        // Start the TCP command server
        val serviceIntent = Intent(this, CommandService::class.java).apply {
            action = CommandService.ACTION_START
            putExtra(CommandService.EXTRA_PORT, CommandService.DEFAULT_PORT)
        }
        startForegroundService(serviceIntent)

        // Start the floating indicator overlay
        if (Settings.canDrawOverlays(this)) {
            startService(Intent(this, FloatingIndicatorService::class.java))
        }
        finish()
    }
}
