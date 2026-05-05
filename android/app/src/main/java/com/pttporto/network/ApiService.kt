package com.pttporto.network

import io.ktor.client.call.*
import io.ktor.client.request.*
import kotlinx.serialization.Serializable

@Serializable
data class AuthResponse(
    val accessToken: String,
    val userId: Int,
    val callsign: String
)

@Serializable
data class UserResponse(
    val id: Int,
    val email: String,
    val callsign: String,
    val role: String,
    val totpEnabled: Boolean
)

@Serializable
data class ChannelResponse(
    val id: Int,
    val name: String,
    val description: String?,
    val adminId: Int,
    val memberCount: Long
)

object ApiService {
    suspend fun login(email: String, password: String): AuthResponse {
        return NetworkClient.client.post("/api/v1/auth/login") {
            setBody(mapOf("email" to email, "password" to password))
            header("Content-Type", "application/json")
        }.body<AuthResponse>()
    }
    
    suspend fun register(email: String, callsign: String, password: String): AuthResponse {
        return NetworkClient.client.post("/api/v1/auth/register") {
            setBody(mapOf("email" to email, "callsign" to callsign, "password" to password))
            header("Content-Type", "application/json")
        }.body<AuthResponse>()
    }
    
    suspend fun getChannels(token: String): List<ChannelResponse> {
        return NetworkClient.client.get("/api/v1/channels") {
            header("Authorization", "Bearer $token")
        }.body<List<ChannelResponse>>()
    }
    
    suspend fun joinChannel(channelId: Int, token: String) {
        NetworkClient.client.post("/api/v1/channels/$channelId/join") {
            header("Authorization", "Bearer $token")
        }
    }
    
    suspend fun createChannel(name: String, description: String?, token: String): ChannelResponse {
        return NetworkClient.client.post("/api/v1/channels") {
            header("Authorization", "Bearer $token")
            header("Content-Type", "application/json")
            setBody(mapOf("name" to name, "description" to description))
        }.body<ChannelResponse>()
    }
}
