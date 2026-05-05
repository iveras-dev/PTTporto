package com.pttporto.data.repository

import com.pttporto.data.models.*
import com.pttporto.data.network.KtorClient
import io.ktor.client.request.*
import io.ktor.http.*

interface ChannelRepository {
    suspend fun getChannels(): Result<List<ChannelResponse>>
    suspend fun searchChannels(query: String): Result<List<ChannelResponse>>
    suspend fun getChannel(id: Int): Result<ChannelResponse>
    suspend fun createChannel(request: CreateChannelRequest): Result<ChannelResponse>
    suspend fun joinChannel(id: Int): Result<ChannelMemberResponse>
    suspend fun leaveChannel(id: Int): Result<Unit>
}

class ChannelRepositoryImpl : ChannelRepository {
    private val client = KtorClient.client
    
    override suspend fun getChannels(): Result<List<ChannelResponse>> {
        return try {
            val response: List<ChannelResponse> = client.get("/channels").body()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun searchChannels(query: String): Result<List<ChannelResponse>> {
        return try {
            val response: List<ChannelResponse> = client.get("/channels/search") {
                parameter("q", query)
            }.body()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun getChannel(id: Int): Result<ChannelResponse> {
        return try {
            val response: ChannelResponse = client.get("/channels/${id}").body()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun createChannel(request: CreateChannelRequest): Result<ChannelResponse> {
        return try {
            val response: ChannelResponse = client.post("/channels") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }.body()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun joinChannel(id: Int): Result<ChannelMemberResponse> {
        return try {
            val response: ChannelMemberResponse = client.post("/channels/${id}/join").body()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun leaveChannel(id: Int): Result<Unit> {
        return try {
            client.post("/channels/${id}/leave")
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
