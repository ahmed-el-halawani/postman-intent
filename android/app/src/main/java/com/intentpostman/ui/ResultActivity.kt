package com.intentpostman.ui

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intentpostman.server.JsonRpcException

/**
 * Transparent activity that starts an intent for result.
 * When the result comes back, it pushes a JSON-RPC notification
 * through the CommandServer and finishes itself.
 *
 * Launched by IntentHandler when forResult=true.
 */
class ResultActivity : ComponentActivity() {

    companion object {
        private const val TAG = "ResultActivity"
        private const val REQUEST_CODE = 9001

        const val EXTRA_REQUEST_ID = "request_id"
        const val EXTRA_ACTION = "intent_action"
        const val EXTRA_COMPONENT = "intent_component"
        const val EXTRA_DATA = "intent_data"
        const val EXTRA_MIME_TYPE = "intent_mime_type"
        const val EXTRA_CATEGORIES = "intent_categories"
        const val EXTRA_FLAGS_INT = "intent_flags_int"
        const val EXTRA_INTENT_EXTRAS_JSON = "intent_extras_json"

        // Static callback — set by IntentHandler before launching
        var onResultCallback: ((String, Int, Int, Intent?) -> Unit)? = null
    }

    private var requestId: String = ""

    private val startActivityForResult =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            Log.e(TAG, "onActivityResult: ${result.resultCode}")
            deliverResult(result.resultCode, result.data)
            finish()
        }


    override fun onResume() {
        super.onResume()
        Log.e(TAG, "onResume: ")
    }


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.e(TAG, "onCreate: ResultActivity")


        // Make this activity click-through so touches pass to the target activity below
        window.setFlags(
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        )

        Log.e(TAG, "onCreate: ")





        requestId = intent.getStringExtra(EXTRA_REQUEST_ID) ?: ""

        val targetIntent = buildTargetIntent()
        Log.e(TAG, "ResultActivity: ")

        try {
            @Suppress("DEPRECATION")
            startActivityForResult.launch(targetIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start activity for result", e)
            deliverResult(RESULT_CANCELED, null)
        }
    }


    private fun deliverResult(resultCode: Int, data: Intent?) {
        onResultCallback?.invoke(requestId, REQUEST_CODE, resultCode, data)
    }

    private fun buildTargetIntent(): Intent {
        val targetIntent = Intent()

        intent.getStringExtra(EXTRA_ACTION)?.takeIf { it.isNotBlank() }?.let {
            targetIntent.action = it
        }

        intent.getStringExtra(EXTRA_COMPONENT)?.takeIf { it.isNotBlank() }?.let { comp ->
            val parts = comp.split("/")
            if (parts.size == 2) {
                val pkg = parts[0]
                val cls = if (parts[1].startsWith(".")) pkg + parts[1] else parts[1]
                targetIntent.component = ComponentName(pkg, cls)
            }
        }

        intent.getStringExtra(EXTRA_DATA)?.takeIf { it.isNotBlank() }?.let {
            targetIntent.data = Uri.parse(it)
        }

        intent.getStringExtra(EXTRA_MIME_TYPE)?.takeIf { it.isNotBlank() }?.let {
            targetIntent.type = it
        }

        intent.getStringArrayExtra(EXTRA_CATEGORIES)?.forEach {
            targetIntent.addCategory(it)
        }


        val jsonObject = Gson().fromJson(intent.getStringExtra(EXTRA_INTENT_EXTRAS_JSON), JsonObject::class.java)
        jsonObject?.getAsJsonArray("extras")?.forEach { extraEl ->
            val extra = extraEl.asJsonObject
            val key = extra.get("key")?.asString ?: return@forEach
            val type = extra.get("type")?.asString ?: "string"
            val value = extra.get("value") ?: return@forEach
            putExtra(targetIntent, key, type, value)
        }


        val flags = intent.getIntExtra(EXTRA_FLAGS_INT, 0)
        if (flags != 0) targetIntent.addFlags(flags)

        return targetIntent
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

}
