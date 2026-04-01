package com.intentpostman.ui

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.intentpostman.server.JsonRpcNotification

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
            Log.e(TAG, "onActivityResult: ${result.resultCode}" )
            deliverResult(result.resultCode, result.data)
            finish()
        }


    override fun onResume() {
        super.onResume()
        Log.e(TAG, "onResume: ", )
    }


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.e(TAG, "onCreate: ", )





        requestId = intent.getStringExtra(EXTRA_REQUEST_ID) ?: ""

        val targetIntent = buildTargetIntent()
        Log.e(TAG, "ResultActivity: " )

        try {
            @Suppress("DEPRECATION")
            startActivityForResult.launch(targetIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start activity for result", e)
            deliverResult(RESULT_CANCELED, null)
            finish()
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

        val flags = intent.getIntExtra(EXTRA_FLAGS_INT, 0)
        if (flags != 0) targetIntent.addFlags(flags)

        return targetIntent
    }
}
