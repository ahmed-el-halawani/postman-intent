package com.intentpostman.handlers

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.Messenger
import android.os.Message
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intentpostman.server.JsonRpcException
import com.intentpostman.server.JsonRpcNotification
import java.lang.reflect.Method

class ServiceHandler(
    private val context: Context,
    private val pushNotification: (JsonRpcNotification) -> Unit
) {
    companion object {
        private const val TAG = "ServiceHandler"
    }

    private val bindings = mutableMapOf<String, ServiceBindingInfo>()

    data class ServiceBindingInfo(
        val connection: ServiceConnection,
        val componentName: String,
        var binder: IBinder? = null,
        var connected: Boolean = false
    )

    /**
     * Start a service.
     */
    fun startService(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")
        val intent = buildServiceIntent(params)

        try {
            context.startService(intent)
            return JsonObject().apply {
                addProperty("status", "started")
                addProperty("component", params.get("component")?.asString ?: "")
            }
        } catch (e: Exception) {
            throw JsonRpcException(-1003, "Failed to start service: ${e.message}")
        }
    }

    /**
     * Stop a service.
     */
    fun stopService(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")
        val intent = buildServiceIntent(params)

        try {
            val stopped = context.stopService(intent)
            return JsonObject().apply {
                addProperty("status", if (stopped) "stopped" else "not_found")
                addProperty("component", params.get("component")?.asString ?: "")
            }
        } catch (e: Exception) {
            throw JsonRpcException(-1003, "Failed to stop service: ${e.message}")
        }
    }

    /**
     * Bind to a service.
     */
    fun bindService(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val component = params.get("component")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'component' param")

        val bindingId = params.get("bindingId")?.asString
            ?: java.util.UUID.randomUUID().toString()

        // Unbind existing
        unbindIfExists(bindingId)

        val connection = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName, binder: IBinder) {
                Log.d(TAG, "Service connected: $name")
                bindings[bindingId]?.binder = binder
                bindings[bindingId]?.connected = true

                // Discover available methods via reflection
                val methods = discoverMethods(binder)

                pushNotification(JsonRpcNotification(
                    method = "service.connected",
                    params = JsonObject().apply {
                        addProperty("bindingId", bindingId)
                        addProperty("component", name.flattenToString())
                        addProperty("binderClass", binder.javaClass.name)
                        add("methods", methods)
                    }
                ))
            }

            override fun onServiceDisconnected(name: ComponentName) {
                Log.d(TAG, "Service disconnected: $name")
                bindings[bindingId]?.connected = false
                bindings[bindingId]?.binder = null

                pushNotification(JsonRpcNotification(
                    method = "service.disconnected",
                    params = JsonObject().apply {
                        addProperty("bindingId", bindingId)
                        addProperty("component", name.flattenToString())
                    }
                ))
            }
        }

        val intent = buildServiceIntent(params)
        val bindFlags = params.get("flags")?.asInt ?: Context.BIND_AUTO_CREATE

        try {
            val bound = context.bindService(intent, connection, bindFlags)
            if (!bound) {
                throw JsonRpcException(-1003, "bindService returned false — service not found or permission denied")
            }

            bindings[bindingId] = ServiceBindingInfo(
                connection = connection,
                componentName = component
            )

            return JsonObject().apply {
                addProperty("status", "binding")
                addProperty("bindingId", bindingId)
                addProperty("component", component)
                addProperty("message", "Waiting for service connection. Result will arrive as 'service.connected' notification.")
            }
        } catch (e: JsonRpcException) {
            throw e
        } catch (e: Exception) {
            throw JsonRpcException(-1003, "Failed to bind service: ${e.message}")
        }
    }

    /**
     * Unbind from a service.
     */
    fun unbindService(params: JsonObject?): JsonElement {
        val bindingId = params?.get("bindingId")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'bindingId' param")

        if (unbindIfExists(bindingId)) {
            return JsonObject().apply {
                addProperty("status", "unbound")
                addProperty("bindingId", bindingId)
            }
        } else {
            throw JsonRpcException(-1003, "No binding found with id: $bindingId")
        }
    }

    /**
     * Call a method on a bound service via reflection.
     */
    fun callMethod(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val bindingId = params.get("bindingId")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'bindingId' param")

        val methodName = params.get("method")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'method' param")

        val binding = bindings[bindingId]
            ?: throw JsonRpcException(-1003, "No binding found with id: $bindingId")

        if (!binding.connected || binding.binder == null) {
            throw JsonRpcException(-1003, "Service not connected")
        }

        val binder = binding.binder!!

        try {
            // Try to find the getService() method pattern (LocalBinder pattern)
            val serviceObj = tryGetServiceFromBinder(binder)
            val target = serviceObj ?: binder

            // Find and invoke the method
            val method = findMethod(target, methodName)
                ?: throw JsonRpcException(-1003, "Method '$methodName' not found on ${target.javaClass.name}")

            val args = buildMethodArgs(method, params.getAsJsonArray("args"))
            val result = method.invoke(target, *args)

            return JsonObject().apply {
                addProperty("status", "success")
                addProperty("method", methodName)
                if (result != null) {
                    addProperty("result", result.toString())
                    addProperty("resultType", result.javaClass.simpleName)
                } else {
                    add("result", null)
                }
            }
        } catch (e: JsonRpcException) {
            throw e
        } catch (e: Exception) {
            throw JsonRpcException(-1003, "Method invocation failed: ${e.message}")
        }
    }

    /**
     * Send a Message to a Messenger-based service.
     */
    fun sendMessage(params: JsonObject?): JsonElement {
        if (params == null) throw JsonRpcException(-32602, "Missing params")

        val bindingId = params.get("bindingId")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'bindingId' param")

        val binding = bindings[bindingId]
            ?: throw JsonRpcException(-1003, "No binding found with id: $bindingId")

        if (!binding.connected || binding.binder == null) {
            throw JsonRpcException(-1003, "Service not connected")
        }

        val what = params.get("what")?.asInt ?: 0
        val arg1 = params.get("arg1")?.asInt ?: 0
        val arg2 = params.get("arg2")?.asInt ?: 0

        try {
            val messenger = Messenger(binding.binder)

            // Set up reply messenger to receive responses
            val replyHandler = Handler(Looper.getMainLooper()) { msg ->
                pushNotification(JsonRpcNotification(
                    method = "service.message",
                    params = JsonObject().apply {
                        addProperty("bindingId", bindingId)
                        addProperty("what", msg.what)
                        addProperty("arg1", msg.arg1)
                        addProperty("arg2", msg.arg2)
                        msg.data?.let { add("data", bundleToJson(it)) }
                    }
                ))
                true
            }

            val msg = Message.obtain(null, what, arg1, arg2)
            msg.replyTo = Messenger(replyHandler)

            params.get("data")?.asJsonObject?.let { dataObj ->
                val bundle = Bundle()
                for ((key, value) in dataObj.entrySet()) {
                    when {
                        value.isJsonPrimitive -> {
                            val prim = value.asJsonPrimitive
                            when {
                                prim.isString -> bundle.putString(key, prim.asString)
                                prim.isNumber -> bundle.putInt(key, prim.asInt)
                                prim.isBoolean -> bundle.putBoolean(key, prim.asBoolean)
                            }
                        }
                    }
                }
                msg.data = bundle
            }

            messenger.send(msg)

            return JsonObject().apply {
                addProperty("status", "sent")
                addProperty("what", what)
            }
        } catch (e: Exception) {
            throw JsonRpcException(-1003, "Failed to send message: ${e.message}")
        }
    }

    /**
     * List all active bindings.
     */
    fun listBindings(params: JsonObject?): JsonElement {
        val arr = JsonArray()
        for ((id, info) in bindings) {
            arr.add(JsonObject().apply {
                addProperty("bindingId", id)
                addProperty("component", info.componentName)
                addProperty("connected", info.connected)
                addProperty("binderClass", info.binder?.javaClass?.name ?: "null")
            })
        }
        return JsonObject().apply {
            addProperty("count", bindings.size)
            add("bindings", arr)
        }
    }

    fun cleanup() {
        for ((_, info) in bindings) {
            try { context.unbindService(info.connection) } catch (_: Exception) {}
        }
        bindings.clear()
    }

    private fun unbindIfExists(bindingId: String): Boolean {
        val info = bindings.remove(bindingId) ?: return false
        try { context.unbindService(info.connection) } catch (_: Exception) {}
        return true
    }

    private fun buildServiceIntent(params: JsonObject): Intent {
        val intent = Intent()
        params.get("component")?.asString?.takeIf { it.isNotBlank() }?.let { comp ->
            val parts = comp.split("/")
            if (parts.size == 2) {
                val pkg = parts[0]
                val cls = if (parts[1].startsWith(".")) pkg + parts[1] else parts[1]
                intent.component = ComponentName(pkg, cls)
            }
        }
        params.get("action")?.asString?.takeIf { it.isNotBlank() }?.let {
            intent.action = it
        }
        params.get("package")?.asString?.takeIf { it.isNotBlank() }?.let {
            intent.setPackage(it)
        }
        return intent
    }

    private fun tryGetServiceFromBinder(binder: IBinder): Any? {
        return try {
            val getServiceMethod = binder.javaClass.getMethod("getService")
            getServiceMethod.invoke(binder)
        } catch (_: Exception) {
            null
        }
    }

    private fun discoverMethods(binder: IBinder): JsonArray {
        val result = JsonArray()
        val target = tryGetServiceFromBinder(binder) ?: binder

        for (method in target.javaClass.declaredMethods) {
            if (method.name.startsWith("access$")) continue
            if (method.name.contains("$")) continue

            val obj = JsonObject()
            obj.addProperty("name", method.name)
            obj.addProperty("returnType", method.returnType.simpleName)

            val paramsArr = JsonArray()
            for (param in method.parameterTypes) {
                paramsArr.add(param.simpleName)
            }
            obj.add("paramTypes", paramsArr)
            result.add(obj)
        }

        return result
    }

    private fun findMethod(target: Any, methodName: String): Method? {
        return target.javaClass.declaredMethods.firstOrNull { it.name == methodName }
    }

    private fun buildMethodArgs(method: Method, argsArray: com.google.gson.JsonArray?): Array<Any?> {
        if (argsArray == null || argsArray.size() == 0) return emptyArray()

        val paramTypes = method.parameterTypes
        val args = Array<Any?>(paramTypes.size) { null }

        for (i in paramTypes.indices) {
            if (i >= argsArray.size()) break
            val arg = argsArray[i]
            args[i] = when (paramTypes[i]) {
                String::class.java -> arg.asString
                Int::class.java, Integer::class.java -> arg.asInt
                Long::class.java, java.lang.Long::class.java -> arg.asLong
                Float::class.java, java.lang.Float::class.java -> arg.asFloat
                Double::class.java, java.lang.Double::class.java -> arg.asDouble
                Boolean::class.java, java.lang.Boolean::class.java -> arg.asBoolean
                else -> arg.asString
            }
        }

        return args
    }

    private fun bundleToJson(bundle: Bundle): JsonObject {
        val obj = JsonObject()
        for (key in bundle.keySet()) {
            try {
                when (val value = bundle.get(key)) {
                    is String -> obj.addProperty(key, value)
                    is Int -> obj.addProperty(key, value)
                    is Long -> obj.addProperty(key, value)
                    is Boolean -> obj.addProperty(key, value)
                    null -> obj.add(key, null)
                    else -> obj.addProperty(key, value.toString())
                }
            } catch (_: Exception) {}
        }
        return obj
    }
}
