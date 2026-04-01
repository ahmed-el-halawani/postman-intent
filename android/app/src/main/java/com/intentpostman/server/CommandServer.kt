package com.intentpostman.server

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.ServerSocket
import java.net.Socket

class CommandServer(
    private val context: Context,
    private val port: Int = 5000
) {
    companion object {
        private const val TAG = "CommandServer"
    }

    private var serverSocket: ServerSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val router = CommandRouter(context) { notification -> pushNotification(notification) }
    private val clients = mutableListOf<ClientConnection>()

    var onStatusChange: ((ServerStatus) -> Unit)? = null

    val connectedClients: Int get() = clients.size

    fun getRouter(): CommandRouter = router

    fun start() {
        scope.launch {
            try {
                serverSocket = ServerSocket(port)
                Log.i(TAG, "Server started on port $port")
                onStatusChange?.invoke(ServerStatus.RUNNING)

                while (isActive) {
                    try {
                        val clientSocket = serverSocket?.accept() ?: break
                        Log.i(TAG, "Client connected: ${clientSocket.remoteSocketAddress}")
                        handleClient(clientSocket)
                    } catch (e: Exception) {
                        if (isActive) {
                            Log.e(TAG, "Error accepting client", e)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Server error", e)
                onStatusChange?.invoke(ServerStatus.ERROR)
            }
        }
    }

    fun stop() {
        scope.cancel()
        clients.forEach { it.close() }
        clients.clear()
        try {
            serverSocket?.close()
        } catch (_: Exception) {}
        serverSocket = null
        onStatusChange?.invoke(ServerStatus.STOPPED)
        Log.i(TAG, "Server stopped")
    }

    fun pushNotification(notification: JsonRpcNotification) {
        val json = notification.toJson()
        clients.toList().forEach { client ->
            try {
                client.writeFrame(json)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to push notification to client", e)
            }
        }
    }

    private fun handleClient(socket: Socket) {
        val client = ClientConnection(socket)
        clients.add(client)
        onStatusChange?.invoke(ServerStatus.RUNNING)

        scope.launch {
            val input = DataInputStream(socket.getInputStream())
            val output = DataOutputStream(socket.getOutputStream())
            client.output = output

            try {
                while (isActive && !socket.isClosed) {
                    val json = Protocol.readFrame(input)
                    Log.d(TAG, "Received: $json")

                    val request = JsonRpcRequest.parse(json)
                    val response = router.route(request)
                    val responseJson = response.toJson()

                    Log.d(TAG, "Sending: $responseJson")
                    Protocol.writeFrame(output, responseJson)
                }
            } catch (e: Exception) {
                if (isActive) {
                    Log.i(TAG, "Client disconnected: ${e.message}")
                }
            } finally {
                client.close()
                clients.remove(client)
                onStatusChange?.invoke(ServerStatus.RUNNING)
            }
        }
    }

    inner class ClientConnection(private val socket: Socket) {
        var output: DataOutputStream? = null

        fun writeFrame(json: String) {
            CoroutineScope(Dispatchers.IO).launch{
                Log.e(TAG, "writeFrame: " )
                output?.let { Protocol.writeFrame(it, json) }
            }
        }

        fun close() {
            try { socket.close() } catch (_: Exception) {}
        }
    }

    enum class ServerStatus {
        STOPPED, RUNNING, ERROR
    }
}
