package com.intentpostman.ui

import android.app.ComponentCaller
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.google.gson.Gson
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


        // Click-through so touches pass to the target activity below, and 1x1 so the
        // relay never asks the compositor for a full-screen surface it draws nothing into.
        window.attributes = window.attributes.apply {
            width = 1
            height = 1
            gravity = Gravity.TOP or Gravity.START
            flags = flags or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_FULLSCREEN
        }

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


    override fun onNewIntent(intent: Intent, caller: ComponentCaller) {
        super.onNewIntent(intent, caller)
        Log.e(TAG, "onNewIntent: caller: " + caller.uid)

    }


    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Log.e(TAG, "onNewIntent: ")
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
            putExtra(targetIntent, key, type, value, extra)
        }


        val flags = intent.getIntExtra(EXTRA_FLAGS_INT, 0)
        if (flags != 0) targetIntent.addFlags(flags)

        return targetIntent
    }

    private fun putExtra(intent: Intent, key: String, type: String, value: JsonElement, extraObj: JsonObject? = null) {
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

                "bundle" -> {
                    val bundle = Bundle()
                    extraObj?.getAsJsonArray("subExtras")?.forEach { subEl ->
                        val sub = subEl.asJsonObject
                        val subKey = sub.get("key")?.asString ?: return@forEach
                        val subType = sub.get("type")?.asString ?: "string"
                        val subValue = sub.get("value") ?: return@forEach
                        putBundleExtra(bundle, subKey, subType, subValue, sub)
                    }
                    intent.putExtra(key, bundle)
                }
            }
        } catch (e: Exception) {
            throw JsonRpcException(
                -32602,
                "Invalid extra value for key '$key' (type=$type): ${e.message}"
            )
        }
    }

    private fun putBundleExtra(bundle: Bundle, key: String, type: String, value: JsonElement, extraObj: JsonObject? = null) {
        try {
            when (type) {
                "string" -> bundle.putString(key, value.asString)
                "int" -> bundle.putInt(key, value.asString.toInt())
                "long" -> bundle.putLong(key, value.asString.toLong())
                "float" -> bundle.putFloat(key, value.asString.toFloat())
                "double" -> bundle.putDouble(key, value.asString.toDouble())
                "bool" -> bundle.putBoolean(key, value.asString.toBooleanStrict())
                "uri" -> bundle.putParcelable(key, Uri.parse(value.asString))
                "string_array" -> {
                    if (value.isJsonArray) {
                        bundle.putStringArray(key, value.asJsonArray.map { it.asString }.toTypedArray())
                    } else {
                        bundle.putStringArray(key, value.asString.split(",").map { it.trim() }.toTypedArray())
                    }
                }

                "int_array" -> {
                    if (value.isJsonArray) {
                        bundle.putIntArray(key, value.asJsonArray.map { it.asInt }.toIntArray())
                    } else {
                        bundle.putIntArray(key, value.asString.split(",").map { it.trim().toInt() }.toIntArray())
                    }
                }

                "bundle" -> {
                    val subBundle = Bundle()
                    extraObj?.getAsJsonArray("subExtras")?.forEach { subEl ->
                        val sub = subEl.asJsonObject
                        val subKey = sub.get("key")?.asString ?: return@forEach
                        val subType = sub.get("type")?.asString ?: "string"
                        val subValue = sub.get("value") ?: return@forEach
                        putBundleExtra(subBundle, subKey, subType, subValue, sub)
                    }
                    bundle.putBundle(key, subBundle)
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
