package com.pttporto.ui.channels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pttporto.data.models.ChannelResponse
import com.pttporto.data.repository.ChannelRepository
import com.pttporto.data.repository.ChannelRepositoryImpl
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class ChannelUiState(
    val isLoading: Boolean = false,
    val channels: List<ChannelResponse> = emptyList(),
    val searchQuery: String = "",
    val error: String? = null
)

sealed class ChannelEvent {
    data class Search(val query: String) : ChannelEvent()
    data class Create(val name: String, val description: String?) : ChannelEvent()
    data class Join(val channelId: Int) : ChannelEvent()
    data class Leave(val channelId: Int) : ChannelEvent()
    object LoadChannels : ChannelEvent()
}

class ChannelViewModel(
    private val channelRepository: ChannelRepository = ChannelRepositoryImpl()
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(ChannelUiState())
    val uiState: StateFlow<ChannelUiState> = _uiState.asStateFlow()
    
    init {
        loadChannels()
    }
    
    fun handleEvent(event: ChannelEvent) {
        when (event) {
            is ChannelEvent.Search -> searchChannels(event.query)
            is ChannelEvent.Create -> createChannel(event.name, event.description)
            is ChannelEvent.Join -> joinChannel(event.channelId)
            is ChannelEvent.Leave -> leaveChannel(event.channelId)
            is ChannelEvent.LoadChannels -> loadChannels()
        }
    }
    
    private fun loadChannels() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            channelRepository.getChannels().fold(
                onSuccess = { channels ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        channels = channels
                    )
                },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Failed to load channels"
                    )
                }
            )
        }
    }
    
    private fun searchChannels(query: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(searchQuery = query, isLoading = true, error = null)
            
            channelRepository.searchChannels(query).fold(
                onSuccess = { channels ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        channels = channels
                    )
                },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Failed to search channels"
                    )
                }
            )
        }
    }
    
    private fun createChannel(name: String, description: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            channelRepository.createChannel(
                com.pttporto.data.models.CreateChannelRequest(name, description)
            ).fold(
                onSuccess = { loadChannels() },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Failed to create channel"
                    )
                }
            )
        }
    }
    
    private fun joinChannel(channelId: Int) {
        viewModelScope.launch {
            channelRepository.joinChannel(channelId).fold(
                onSuccess = { loadChannels() },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        error = error.message ?: "Failed to join channel"
                    )
                }
            )
        }
    }
    
    private fun leaveChannel(channelId: Int) {
        viewModelScope.launch {
            channelRepository.leaveChannel(channelId).fold(
                onSuccess = { loadChannels() },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        error = error.message ?: "Failed to leave channel"
                    )
                }
            )
        }
    }
}
