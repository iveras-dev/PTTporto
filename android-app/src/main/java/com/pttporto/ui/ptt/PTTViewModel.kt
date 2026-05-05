package com.pttporto.ui.ptt

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pttporto.data.storage.TokenStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

data class PTTUiState(
    val channelName: String = "",
    val isTransmitting: Boolean = false,
    val isReceiving: Boolean = false,
    val activeCallerCallsign: String = "",
    val statusMessage: String = "",
    val isConnected: Boolean = false
)

sealed class PTTEvent {
    object StartTransmit : PTTEvent()
    object StopTransmit : PTTEvent()
    object Disconnect : PTTEvent()
}

class PTTViewModel(
    private val tokenStorage: TokenStorage? = null
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(PTTUiState())
    val uiState: StateFlow<PTTUiState> = _uiState.asStateFlow()
    
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient()
    
    fun connectWebSocket(channelId: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val token = tokenStorage?.let { storage ->
                    // Get token from DataStore (simplified)
                    ""
                } ?: ""
                
                val request = Request.Builder()
                    .url("ws://10.0.2.2:8080/ws/ptt/$channelId?token=$token")
                    .build()
                
                webSocket = client.newWebSocket(request, object : WebSocketListener() {
                    override fun onOpen(ws: WebSocket, response: okhttp3.Response) {
                        viewModelScope.launch {
                            _uiState.value = _uiState.value.copy(
                                isConnected = true,
                                statusMessage = "Connected to channel"
                            )
                        }
                    }
                    
                    override fun onMessage(ws: WebSocket, text: String) {
                        handleMessage(text)
                    }
                    
                    override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                        viewModelScope.launch {
                            _uiState.value = _uiState.value.copy(
                                isConnected = false,
                                statusMessage = "Disconnected: $reason"
                            )
                        }
                    }
                })
            } catch (e: Exception) {
                Log.e("PTTViewModel", "WebSocket connection failed", e)
                _uiState.value = _uiState.value.copy(
                    statusMessage = "Connection failed: ${e.message}"
                )
            }
        }
    }
    
    fun handleEvent(event: PTTEvent) {
        when (event) {
            is PTTEvent.StartTransmit -> startTransmit()
            is PTTEvent.StopTransmit -> stopTransmit()
            is PTTEvent.Disconnect -> disconnect()
        }
    }
    
    private fun startTransmit() {
        webSocket?.send(JSONObject(mapOf("type" to "ptt_start")).toString())
        _uiState.value = _uiState.value.copy(
            isTransmitting = true,
            statusMessage = "Transmitting..."
        )
    }
    
    private fun stopTransmit() {
        webSocket?.send(JSONObject(mapOf("type" to "ptt_stop")).toString())
        _uiState.value = _uiState.value.copy(
            isTransmitting = false,
            statusMessage = "Transmission ended"
        )
    }
    
    private fun disconnect() {
        webSocket?.close(1000, "User left channel")
        webSocket = null
        _uiState.value = PTTUiState()
    }
    
    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            when (json.getString("type")) {
                "ptt_start" -> {
                    val callsign = json.getString("callsign")
                    _uiState.value = _uiState.value.copy(
                        isReceiving = true,
                        activeCallerCallsign = callsign,
                        statusMessage = "Receiving from $callsign"
                    )
                }
                "ptt_stop" -> {
                    _uiState.value = _uiState.value.copy(
                        isReceiving = false,
                        activeCallerCallsign = "",
                        statusMessage = "Transmission ended"
                    )
                    // Play roger beep here
                }
                "ptt_denied" -> {
                    _uiState.value = _uiState.value.copy(
                        statusMessage = json.getString("message")
                    )
                }
                "webrtc_signal" -> {
                    // Handle WebRTC signaling for audio stream
                }
            }
        } catch (e: Exception) {
            Log.e("PTTViewModel", "Error handling message", e)
        }
    }
    
    override fun onCleared() {
        super.onCleared()
        disconnect()
    }
}
