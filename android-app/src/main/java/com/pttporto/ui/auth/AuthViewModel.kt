package com.pttporto.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pttporto.data.models.AuthResponse
import com.pttporto.data.repository.AuthRepository
import com.pttporto.data.repository.AuthRepositoryImpl
import com.pttporto.data.storage.TokenStorage
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val callsign: String = "",
    val error: String? = null
)

sealed class AuthEvent {
    data class Login(val email: String, val password: String) : AuthEvent()
    data class Register(val email: String, val callsign: String, val password: String) : AuthEvent()
    object Logout : AuthEvent()
}

class AuthViewModel(
    private val authRepository: AuthRepository = AuthRepositoryImpl(),
    private val tokenStorage: TokenStorage? = null
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    
    fun handleEvent(event: AuthEvent) {
        when (event) {
            is AuthEvent.Login -> login(event.email, event.password)
            is AuthEvent.Register -> register(event.email, event.callsign, event.password)
            is AuthEvent.Logout -> logout()
        }
    }
    
    private fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            authRepository.login(email, password).fold(
                onSuccess = { authResponse ->
                    tokenStorage?.let { storage ->
                        storage.saveTokens(authResponse.accessToken, authResponse.refreshToken)
                        storage.saveUserInfo(
                            authResponse.user.id,
                            authResponse.user.callsign,
                            authResponse.user.role
                        )
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        callsign = authResponse.user.callsign
                    )
                },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Login failed"
                    )
                }
            )
        }
    }
    
    private fun register(email: String, callsign: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            authRepository.register(email, callsign, password).fold(
                onSuccess = { authResponse ->
                    tokenStorage?.let { storage ->
                        storage.saveTokens(authResponse.accessToken, authResponse.refreshToken)
                        storage.saveUserInfo(
                            authResponse.user.id,
                            authResponse.user.callsign,
                            authResponse.user.role
                        )
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        callsign = authResponse.user.callsign
                    )
                },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Registration failed"
                    )
                }
            )
        }
    }
    
    private fun logout() {
        viewModelScope.launch {
            tokenStorage?.clearAll()
            _uiState.value = AuthUiState()
        }
    }
}
