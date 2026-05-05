package com.pttporto.data.models

import kotlinx.serialization.Serializable

@Serializable
data class UserResponse(
    val id: Int,
    val email: String,
    val callsign: String,
    val role: String,
    val totpEnabled: Boolean,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserResponse
)

@Serializable
data class CreateUserRequest(
    val email: String,
    val callsign: String,
    val password: String,
    val role: String = "USER"
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class UpdateUserRequest(
    val email: String? = null,
    val callsign: String? = null,
    val password: String? = null,
    val role: String? = null
)
