package com.pttporto.data.models

import kotlinx.serialization.Serializable

@Serializable
data class ChannelResponse(
    val id: Int,
    val name: String,
    val description: String?,
    val adminCallsign: String,
    val searchTags: String?,
    val memberCount: Int,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class CreateChannelRequest(
    val name: String,
    val description: String? = null,
    val searchTags: String? = null
)

@Serializable
data class UpdateChannelRequest(
    val name: String? = null,
    val description: String? = null,
    val searchTags: String? = null
)

@Serializable
data class ChannelMemberResponse(
    val id: Int,
    val channelId: Int,
    val userId: Int,
    val userCallsign: String,
    val role: String,
    val joinedAt: String
)
