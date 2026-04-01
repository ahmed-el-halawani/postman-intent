package com.intentpostman.server

import android.content.Context
import android.os.Build
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intentpostman.handlers.BroadcastHandler
import com.intentpostman.handlers.IntentHandler
import com.intentpostman.handlers.PackageQueryHandler
import com.intentpostman.handlers.ServiceHandler

class CommandRouter(
    private val context: Context,
    private val pushNotification: (JsonRpcNotification) -> Unit = {}
) {

    private val handlers = mutableMapOf<String, suspend (JsonObject?) -> JsonElement>()
    private val intentHandler = IntentHandler(context, pushNotification)
    private val packageQueryHandler = PackageQueryHandler(context)
    private val broadcastHandler = BroadcastHandler(context, pushNotification)
    private val serviceHandler = ServiceHandler(context, pushNotification)

    init {
        // System handlers
        registerHandler("system.ping") { handlePing() }
        registerHandler("system.info") { handleInfo() }

        // Intent handlers
        registerHandler("intent.send") { params -> intentHandler.sendIntent(params) }

        // Broadcast handlers
        registerHandler("broadcast.send") { params -> broadcastHandler.sendBroadcast(params) }
        registerHandler("broadcast.listen") { params -> broadcastHandler.listen(params) }
        registerHandler("broadcast.unlisten") { params -> broadcastHandler.unlisten(params) }
        registerHandler("broadcast.listListeners") { params -> broadcastHandler.listListeners(params) }
        registerHandler("broadcast.unlistenAll") { params -> broadcastHandler.unlistenAll(params) }

        // Service handlers
        registerHandler("service.start") { params -> serviceHandler.startService(params) }
        registerHandler("service.stop") { params -> serviceHandler.stopService(params) }
        registerHandler("service.bind") { params -> serviceHandler.bindService(params) }
        registerHandler("service.unbind") { params -> serviceHandler.unbindService(params) }
        registerHandler("service.call") { params -> serviceHandler.callMethod(params) }
        registerHandler("service.sendMessage") { params -> serviceHandler.sendMessage(params) }
        registerHandler("service.listBindings") { params -> serviceHandler.listBindings(params) }

        // Package query handlers
        registerHandler("package.queryComponents") { params -> packageQueryHandler.queryComponents(params) }
        registerHandler("package.getQuickActions") { params -> packageQueryHandler.getQuickActions(params) }
        registerHandler("package.listPackages") { params -> packageQueryHandler.listPackages(params) }
        registerHandler("package.queryIntents") { params -> packageQueryHandler.queryPackageIntents(params) }
    }

    fun cleanup() {
        broadcastHandler.cleanup()
        serviceHandler.cleanup()
    }

    fun registerHandler(method: String, handler: suspend (JsonObject?) -> JsonElement) {
        handlers[method] = handler
    }

    suspend fun route(request: JsonRpcRequest): JsonRpcResponse {
        val handler = handlers[request.method]
            ?: return JsonRpcResponse(
                id = request.id,
                error = JsonRpcError(-32601, "Method not found: ${request.method}")
            )

        return try {
            val result = handler(request.params)
            JsonRpcResponse(id = request.id, result = result)
        } catch (e: JsonRpcException) {
            JsonRpcResponse(
                id = request.id,
                error = JsonRpcError(e.code, e.message)
            )
        } catch (e: Exception) {
            JsonRpcResponse(
                id = request.id,
                error = JsonRpcError(-32603, "Internal error: ${e.message}")
            )
        }
    }

    private fun handlePing(): JsonElement {
        return JsonObject().apply {
            addProperty("status", "pong")
            addProperty("version", "1.0.0")
        }
    }

    private fun handleInfo(): JsonElement {
        return JsonObject().apply {
            addProperty("model", Build.MODEL)
            addProperty("manufacturer", Build.MANUFACTURER)
            addProperty("androidVersion", Build.VERSION.RELEASE)
            addProperty("apiLevel", Build.VERSION.SDK_INT)
            addProperty("device", Build.DEVICE)
            addProperty("product", Build.PRODUCT)
        }
    }
}
