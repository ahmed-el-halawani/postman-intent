package com.intentpostman.server

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException

/**
 * Length-prefixed framing protocol for JSON-RPC 2.0 over TCP.
 * Each frame: 4-byte big-endian uint32 (payload length) + UTF-8 JSON payload.
 */
object Protocol {

    @Throws(IOException::class)
    fun readFrame(input: DataInputStream): String {
        val length = input.readInt()
        if (length <= 0 || length > 10 * 1024 * 1024) {
            throw IOException("Invalid frame length: $length")
        }
        val payload = ByteArray(length)
        input.readFully(payload)
        return String(payload, Charsets.UTF_8)
    }

    @Throws(IOException::class)
    fun writeFrame(output: DataOutputStream, json: String) {
        val payload = json.toByteArray(Charsets.UTF_8)
        output.writeInt(payload.size)
        output.write(payload)
        output.flush()
    }
}

// JSON-RPC 2.0 data classes

data class JsonRpcRequest(
    val jsonrpc: String,
    val id: String,
    val method: String,
    val params: JsonObject?
) {
    companion object {
        fun parse(json: String): JsonRpcRequest {
            val obj = JsonParser.parseString(json).asJsonObject
            return JsonRpcRequest(
                jsonrpc = obj.get("jsonrpc")?.asString ?: "2.0",
                id = obj.get("id")?.asString ?: "",
                method = obj.get("method")?.asString ?: "",
                params = obj.get("params")?.asJsonObject
            )
        }
    }
}

data class JsonRpcResponse(
    val jsonrpc: String = "2.0",
    val id: String,
    val result: JsonElement? = null,
    val error: JsonRpcError? = null
) {
    fun toJson(): String {
        val obj = JsonObject()
        obj.addProperty("jsonrpc", jsonrpc)
        obj.addProperty("id", id)
        if (result != null) obj.add("result", result)
        if (error != null) {
            val errObj = JsonObject()
            errObj.addProperty("code", error.code)
            errObj.addProperty("message", error.message)
            if (error.data != null) errObj.addProperty("data", error.data)
            obj.add("error", errObj)
        }
        return obj.toString()
    }
}

data class JsonRpcError(
    val code: Int,
    val message: String,
    val data: String? = null
)

data class JsonRpcNotification(
    val jsonrpc: String = "2.0",
    val method: String,
    val params: JsonObject? = null
) {
    fun toJson(): String {
        val obj = JsonObject()
        obj.addProperty("jsonrpc", jsonrpc)
        obj.addProperty("method", method)
        if (params != null) obj.add("params", params)
        return obj.toString()
    }
}

class JsonRpcException(val code: Int, override val message: String) : Exception(message)
