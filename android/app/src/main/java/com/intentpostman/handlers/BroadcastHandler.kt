package com.intentpostman.handlers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intentpostman.server.JsonRpcException
import com.intentpostman.server.JsonRpcNotification
import java.time.Instant

class BroadcastHandler(
    private val context: Context,
    private val pushNotification: (JsonRpcNotification) -> Unit
) {
    companion object {
        private const val TAG = "BroadcastHandler"
    }

    private val listeners = mutableMapOf<String, BroadcastReceiver>()

    /**
     * Send a broadcast intent.
     */
    fun sendBroadcast(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val action = params.get("action")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'action' param")

        val intent = Intent(action)

        params.get("package")?.asString?.takeIf { it.isNotBlank() }?.let {
            intent.setPackage(it)
        }

        params.getAsJsonArray("extras")?.forEach { extraEl ->
            val extra = extraEl.asJsonObject
            val key = extra.get("key")?.asString ?: return@forEach
            val value = extra.get("value")?.asString ?: return@forEach
            intent.putExtra(key, value)
        }

        try {
            context.sendBroadcast(intent)
            return JsonObject().apply {
                addProperty("status", "sent")
                addProperty("action", action)
            }
        } catch (e: Exception) {
            throw JsonRpcException(-1002, "Failed to send broadcast: ${e.message}")
        }
    }

    /**
     * Register a dynamic BroadcastReceiver and push events as notifications.
     */
    fun listen(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val action = params.get("action")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'action' param")

        val listenerId = params.get("listenerId")?.asString
            ?: java.util.UUID.randomUUID().toString()

        // Unregister existing listener with same ID
        listeners[listenerId]?.let {
            try { context.unregisterReceiver(it) } catch (_: Exception) {}
        }

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                Log.d(TAG, "Broadcast received: ${intent.action}")

                val eventParams = JsonObject().apply {
                    addProperty("listenerId", listenerId)
                    addProperty("action", intent.action ?: "")
                    addProperty("timestamp", Instant.now().toString())

                    intent.dataString?.let { addProperty("dataUri", it) }
                    intent.type?.let { addProperty("mimeType", it) }

                    val extras = intent.extras
                    if (extras != null) {
                        add("extras", bundleToJson(extras))
                    }
                }

                pushNotification(
                    JsonRpcNotification(
                        method = "broadcast.event",
                        params = eventParams
                    )
                )
            }
        }

        val filter = IntentFilter(action)

        // Add additional actions if specified
        params.getAsJsonArray("actions")?.forEach {
            filter.addAction(it.asString)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiver, filter)
        }

        listeners[listenerId] = receiver

        return JsonObject().apply {
            addProperty("status", "listening")
            addProperty("listenerId", listenerId)
            addProperty("action", action)
            addProperty("activeListeners", listeners.size)
        }
    }

    /**
     * Unregister a broadcast listener.
     */
    fun unlisten(params: JsonObject?): JsonElement {
        val listenerId = params?.get("listenerId")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'listenerId' param")

        val receiver = listeners.remove(listenerId)
        if (receiver != null) {
            try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
            return JsonObject().apply {
                addProperty("status", "stopped")
                addProperty("listenerId", listenerId)
                addProperty("activeListeners", listeners.size)
            }
        } else {
            throw JsonRpcException(-1002, "No listener found with id: $listenerId")
        }
    }

    /**
     * List all active broadcast listeners.
     */
    fun listListeners(params: JsonObject?): JsonElement {
        val arr = JsonArray()
        for ((id, _) in listeners) {
            arr.add(JsonObject().apply {
                addProperty("listenerId", id)
            })
        }
        return JsonObject().apply {
            addProperty("count", listeners.size)
            add("listeners", arr)
        }
    }

    /**
     * Unregister all listeners (cleanup).
     */
    fun unlistenAll(params: JsonObject?): JsonElement {
        val count = listeners.size
        for ((_, receiver) in listeners) {
            try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
        }
        listeners.clear()
        return JsonObject().apply {
            addProperty("status", "all_stopped")
            addProperty("removed", count)
        }
    }

    /**
     * Call on service destroy to clean up.
     */
    fun cleanup() {
        for ((_, receiver) in listeners) {
            try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
        }
        listeners.clear()
    }

    private fun bundleToJson(bundle: Bundle): JsonObject {
        val obj = JsonObject()
        for (key in bundle.keySet()) {
            try {
                when (val value = bundle.get(key)) {
                    is String -> obj.addProperty(key, value)
                    is Int -> obj.addProperty(key, value)
                    is Long -> obj.addProperty(key, value)
                    is Float -> obj.addProperty(key, value)
                    is Double -> obj.addProperty(key, value)
                    is Boolean -> obj.addProperty(key, value)
                    is Uri -> obj.addProperty(key, value.toString())
                    is Bundle -> obj.add(key, bundleToJson(value))
                    is IntArray -> {
                        val arr = JsonArray(); value.forEach { arr.add(it) }; obj.add(key, arr)
                    }
                    is Array<*> -> {
                        val arr = JsonArray(); value.forEach { arr.add(it?.toString()) }; obj.add(key, arr)
                    }
                    null -> obj.add(key, null)
                    else -> obj.addProperty(key, value.toString())
                }
            } catch (_: Exception) {
                obj.addProperty(key, "[unserializable]")
            }
        }
        return obj
    }
}
