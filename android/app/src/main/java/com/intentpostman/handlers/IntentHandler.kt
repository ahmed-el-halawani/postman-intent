package com.intentpostman.handlers

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intentpostman.server.JsonRpcException
import com.intentpostman.server.JsonRpcNotification
import com.intentpostman.ui.ResultActivity
import kotlinx.coroutines.CompletableDeferred

class IntentHandler(
    private val context: Context,
    private val pushNotification: ((JsonRpcNotification) -> Unit)? = null
) {

    fun sendIntent(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val type = params.get("type")?.asString ?: "activity"
        val forResult = params.get("forResult")?.asBoolean ?: false

        if (forResult && type == "activity") {
            return sendIntentForResult(params)
        }

        val intent = buildIntent(params)

        return when (type) {
            "activity" -> {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                try {
                    context.startActivity(intent)
                    JsonObject().apply {
                        addProperty("status", "sent")
                        addProperty("type", "activity")
                        addProperty("action", intent.action ?: "")
                    }
                } catch (e: Exception) {
                    throw JsonRpcException(-1001, "Failed to start activity: ${e.message}")
                }
            }

            "broadcast" -> {
                try {
                    context.sendBroadcast(intent)
                    JsonObject().apply {
                        addProperty("status", "sent")
                        addProperty("type", "broadcast")
                        addProperty("action", intent.action ?: "")
                    }
                } catch (e: Exception) {
                    throw JsonRpcException(-1002, "Failed to send broadcast: ${e.message}")
                }
            }

            "service" -> {
                try {
                    context.startService(intent)
                    JsonObject().apply {
                        addProperty("status", "sent")
                        addProperty("type", "service")
                        addProperty("action", intent.action ?: "")
                    }
                } catch (e: Exception) {
                    throw JsonRpcException(-1003, "Failed to start service: ${e.message}")
                }
            }

            else -> throw JsonRpcException(-32602, "Unknown intent type: $type")
        }
    }

    /**
     * Starts an activity for result via the transparent ResultActivity.
     * The result will be pushed as a notification since it's async.
     */
    private fun sendIntentForResult(params: JsonObject): JsonElement {
        val requestId = java.util.UUID.randomUUID().toString()

        // Set up the result callback before launching
        ResultActivity.onResultCallback = { reqId, requestCode, resultCode, data ->
            val resultObj = JsonObject().apply {
                addProperty("requestId", reqId)
                addProperty("resultCode", resultCode)
                addProperty(
                    "resultCodeName", when (resultCode) {
                        Activity.RESULT_OK -> "RESULT_OK"
                        Activity.RESULT_CANCELED -> "RESULT_CANCELED"
                        Activity.RESULT_FIRST_USER -> "RESULT_FIRST_USER"
                        else -> "UNKNOWN ($resultCode)"
                    }
                )

                // Extract result data
                if (data != null) {
                    data.dataString?.let { addProperty("dataUri", it) }
                    data.action?.let { addProperty("action", it) }
                    data.type?.let { addProperty("mimeType", it) }

                    // Extract extras from result
                    val extras = data.extras
                    if (extras != null) {
                        add("extras", bundleToJson(extras))
                    }

                    // Extract clip data (used for multi-image picks etc.)
                    data.clipData?.let { clip ->
                        val clipArr = JsonArray()
                        for (i in 0 until clip.itemCount) {
                            val item = clip.getItemAt(i)
                            val itemObj = JsonObject()
                            item.uri?.let { uri -> itemObj.addProperty("uri", uri.toString()) }
                            item.text?.let { text -> itemObj.addProperty("text", text.toString()) }
                            clipArr.add(itemObj)
                        }
                        add("clipData", clipArr)
                    }
                }
            }

            Log.e("IntentHandler", "sendIntentForResult: $resultObj")

            // Push the result as a notification
            pushNotification?.invoke(
                JsonRpcNotification(
                    method = "intent.result",
                    params = resultObj
                )
            )
        }

        // Launch the transparent ResultActivity
        val launchIntent = Intent(context, ResultActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra(ResultActivity.EXTRA_REQUEST_ID, requestId)
            putExtra(ResultActivity.EXTRA_ACTION, params.get("action")?.asString ?: "")
            putExtra(ResultActivity.EXTRA_COMPONENT, params.get("component")?.asString ?: "")
            putExtra(ResultActivity.EXTRA_DATA, params.get("data")?.asString ?: "")
            putExtra(ResultActivity.EXTRA_MIME_TYPE, params.get("mimeType")?.asString ?: "")

            // Categories
            params.getAsJsonArray("categories")?.let { cats ->
                putExtra(ResultActivity.EXTRA_CATEGORIES, cats.map { it.asString }.toTypedArray())
            }
        }

        try {
            context.startActivity(launchIntent)
            return JsonObject().apply {
                addProperty("status", "launched_for_result")
                addProperty("requestId", requestId)
                addProperty(
                    "message",
                    "Activity launched. Result will arrive as 'intent.result' notification."
                )
            }
        } catch (e: Exception) {
            throw JsonRpcException(-1001, "Failed to start activity for result: ${e.message}")
        }
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
                        val arr = JsonArray()
                        value.forEach { arr.add(it) }
                        obj.add(key, arr)
                    }

                    is Array<*> -> {
                        val arr = JsonArray()
                        value.forEach { arr.add(it?.toString()) }
                        obj.add(key, arr)
                    }

                    null -> obj.add(key, null)
                    else -> obj.addProperty(key, value.toString())
                }
            } catch (_: Exception) {
                obj.addProperty(key, "[unserializable: ${bundle.get(key)?.javaClass?.name}]")
            }
        }
        return obj
    }

    private fun buildIntent(params: JsonObject): Intent {
        val intent = Intent()

        params.get("action")?.asString?.takeIf { it.isNotBlank() }?.let {
            intent.action = it
        }

        params.get("component")?.asString?.takeIf { it.isNotBlank() }?.let { comp ->
            val parts = comp.split("/")
            if (parts.size == 2) {
                val pkg = parts[0]
                val cls = if (parts[1].startsWith(".")) pkg + parts[1] else parts[1]
                intent.component = ComponentName(pkg, cls)
            }
        }

        params.get("data")?.asString?.takeIf { it.isNotBlank() }?.let {
            intent.data = Uri.parse(it)
        }

        params.get("mimeType")?.asString?.takeIf { it.isNotBlank() }?.let {
            intent.type = it
        }

        params.getAsJsonArray("categories")?.forEach {
            intent.addCategory(it.asString)
        }

        params.getAsJsonArray("flags")?.forEach { flagEl ->
            val flag = resolveFlag(flagEl.asString)
            if (flag != 0) intent.addFlags(flag)
        }

        params.getAsJsonArray("extras")?.forEach { extraEl ->
            val extra = extraEl.asJsonObject
            val key = extra.get("key")?.asString ?: return@forEach
            val type = extra.get("type")?.asString ?: "string"
            val value = extra.get("value") ?: return@forEach
            putExtra(intent, key, type, value)
        }

        return intent
    }

    private fun putExtra(intent: Intent, key: String, type: String, value: JsonElement) {
        try {
            when (type) {
                "string" -> intent.putExtra(key, value.asString)
                "int" -> intent.putExtra(key, value.asString.toInt())
                "long" -> intent.putExtra(key, value.asString.toLong())
                "float" -> intent.putExtra(key, value.asString.toFloat())
                "double" -> intent.putExtra(key, value.asString.toDouble())
                "bool" -> intent.putExtra(key, value.asString.toBooleanStrict())
                "uri" -> intent.putExtra(key, Uri.parse(value.asString))
                "string_array" -> {
                    if (value.isJsonArray) {
                        intent.putExtra(key, value.asJsonArray.map { it.asString }.toTypedArray())
                    } else {
                        intent.putExtra(
                            key,
                            value.asString.split(",").map { it.trim() }.toTypedArray()
                        )
                    }
                }

                "int_array" -> {
                    if (value.isJsonArray) {
                        intent.putExtra(key, value.asJsonArray.map { it.asInt }.toIntArray())
                    } else {
                        intent.putExtra(
                            key,
                            value.asString.split(",").map { it.trim().toInt() }.toIntArray()
                        )
                    }
                }
            }
        } catch (e: Exception) {
            throw JsonRpcException(
                -32602,
                "Invalid extra value for key '$key' (type=$type): ${e.message}"
            )
        }
    }

    @Suppress("CyclomaticComplexMethod")
    private fun resolveFlag(name: String): Int {
        return when (name) {
            "FLAG_ACTIVITY_NEW_TASK" -> Intent.FLAG_ACTIVITY_NEW_TASK
            "FLAG_ACTIVITY_CLEAR_TOP" -> Intent.FLAG_ACTIVITY_CLEAR_TOP
            "FLAG_ACTIVITY_SINGLE_TOP" -> Intent.FLAG_ACTIVITY_SINGLE_TOP
            "FLAG_ACTIVITY_CLEAR_TASK" -> Intent.FLAG_ACTIVITY_CLEAR_TASK
            "FLAG_ACTIVITY_NO_HISTORY" -> Intent.FLAG_ACTIVITY_NO_HISTORY
            "FLAG_ACTIVITY_NO_ANIMATION" -> Intent.FLAG_ACTIVITY_NO_ANIMATION
            "FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS" -> Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
            "FLAG_ACTIVITY_FORWARD_RESULT" -> Intent.FLAG_ACTIVITY_FORWARD_RESULT
            "FLAG_ACTIVITY_MULTIPLE_TASK" -> Intent.FLAG_ACTIVITY_MULTIPLE_TASK
            "FLAG_ACTIVITY_REORDER_TO_FRONT" -> Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            "FLAG_INCLUDE_STOPPED_PACKAGES" -> Intent.FLAG_INCLUDE_STOPPED_PACKAGES
            "FLAG_RECEIVER_FOREGROUND" -> Intent.FLAG_RECEIVER_FOREGROUND
            else -> 0
        }
    }
}
