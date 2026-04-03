package com.intentpostman.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Starts the CommandService automatically when the device boots.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            val serviceIntent = Intent(context, CommandService::class.java).apply {
                action = CommandService.ACTION_START
                putExtra(CommandService.EXTRA_PORT, CommandService.DEFAULT_PORT)
            }
            context.startForegroundService(serviceIntent)
        }
    }
}
