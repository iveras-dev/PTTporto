package com.pttporto.data.repository

import com.pttporto.data.models.*
import com.pttporto.data.network.KtorClient
import io.ktor.client.request.*
import io.ktor.http.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<AuthResponse>
    suspend fun register(email: String, callsign: String, password: String): Result<AuthResponse>
    suspend fun getCurrentUser(token: String): Result<UserResponse>
    suspend fun logout()
}

class AuthRepositoryImpl : AuthRepository {
    private val client = KtorClient.client
    
    override suspend fun login(email: String, password: String): Result<AuthResponse> {
        return try {
            val response: AuthResponse = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody(LoginRequest(email, password))
            }.body()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun register(email: String, callsign: String, password: String): Result<AuthResponse> {
        return try {
            val response: AuthResponse = client.post("/auth/register") {
                contentType(ContentType.Application.Json)
                setBody(CreateUserRequest(email, callsign, password))
            }.body()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun getCurrentUser(token: String): Result<UserResponse> {
        return try {
            val response: UserResponse = client.get("/users/me") {
                headers {
                    append("Authorization", "Bearer $token")
                }
            }.body()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun logout() {
        // Clear local storage (implemented in DataStore)
    }
}
