package com.pttporto

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.routing.*
import io.ktor.server.response.*
import io.ktor.server.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import java.util.Date
import kotlinx.serialization.Serializable
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.javatime.*
import at.favre.lib.crypto.bcrypt.BCrypt

// Tables
object Users : IntIdTable("users") {
    val email = varchar("email", 255).uniqueIndex()
    val callsign = varchar("callsign", 50).uniqueIndex()
    val passwordHash = varchar("password_hash", 255)
    val role = enumerationByName("role", 20, UserRole::class).default(UserRole.USER)
    val totpEnabled = bool("totp_enabled").default(false)
    val totpSecret = varchar("totp_secret", 255).nullable()
    val createdAt = datetime("created_at").defaultExpression(CurrentDateTime)
    val updatedAt = datetime("updated_at").defaultExpression(CurrentDateTime)
}

object Channels : IntIdTable("channels") {
    val name = varchar("name", 100)
    val description = text("description").nullable()
    val admin = reference("admin_id", Users)
    val createdAt = datetime("created_at").defaultExpression(CurrentDateTime)
    val updatedAt = datetime("updated_at").defaultExpression(CurrentDateTime)
}

object ChannelMembers : IntIdTable("channel_members") {
    val channelId = reference("channel_id", Channels)
    val userId = reference("user_id", Users)
    val role = enumerationByName("role", 20, ChannelRole::class).default(ChannelRole.LISTENER)
    val joinedAt = datetime("joined_at").defaultExpression(CurrentDateTime)
}

// Entities
class UserEntity(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<UserEntity>(Users)
    var email by Users.email
    var callsign by Users.callsign
    var passwordHash by Users.passwordHash
    var role by Users.role
    var totpEnabled by Users.totpEnabled
    var totpSecret by Users.totpSecret
    var createdAt by Users.createdAt
    var updatedAt by Users.updatedAt
}

class ChannelEntity(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<ChannelEntity>(Channels)
    var name by Channels.name
    var description by Channels.description
    var admin by UserEntity referencedOn Channels.admin
    var createdAt by Channels.createdAt
    var updatedAt by Channels.updatedAt
}

class ChannelMemberEntity(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<ChannelMemberEntity>(ChannelMembers)
    var channel by ChannelEntity referencedOn ChannelMembers.channelId
    var user by UserEntity referencedOn ChannelMembers.userId
    var role by ChannelMembers.role
    var joinedAt by ChannelMembers.joinedAt
}

enum class UserRole { SUPERADMIN, ADMIN, USER }
enum class ChannelRole { ADMIN, LISTENER }

// DTOs
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
    val adminCallsign: String,
    val memberCount: Long,
    val userRole: String? = null
)

fun main() {
    embeddedServer(Netty, port = 8082) {
        install(ContentNegotiation) {
            json()
        }
        
        install(WebSockets) {
            pingPeriod = java.time.Duration.ofSeconds(15)
            timeout = java.time.Duration.ofSeconds(15)
            maxFrameSize = Long.MAX_VALUE
            masking = false
        }
        
        install(Authentication) {
            jwt("auth-jwt") {
                realm = "pttporto"
                verifier(JWT.require(Algorithm.HMAC256("secret"))
                    .withIssuer("pttporto-api")
                    .withAudience("pttporto-app")
                    .build())
                validate { credential ->
                    if (credential.payload.audience.contains("pttporto-app")) {
                        JWTPrincipal(credential.payload)
                    } else null
                }
            }
        }
        
        // CORS support for web client
        intercept(ApplicationCallPipeline.Call) {
            call.response.header("Access-Control-Allow-Origin", "*")
            call.response.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            call.response.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            if (call.request.httpMethod == HttpMethod.Options) {
                call.respond(HttpStatusCode.OK)
                return@intercept
            }
        }
        
        // Database init
        val config = HikariConfig().apply {
            jdbcUrl = "jdbc:h2:/Users/gast/Downloads/PTTPorto/backend/pttporto_db;DB_CLOSE_DELAY=-1"
            username = "sa"
            password = ""
            driverClassName = "org.h2.Driver"
        }
        val dataSource = HikariDataSource(config)
        Database.connect(dataSource)
        
        transaction {
            SchemaUtils.create(Users, Channels, ChannelMembers)
        }
        
        routing {
            // Health check
            get("/health") {
                call.respond(mapOf("status" to "ok"))
            }
            
            // Auth routes
            post("/api/v1/auth/register") {
                try {
                    val params = call.receive<Map<String, String>>()
                    val email = params["email"] ?: throw IllegalArgumentException("Email required")
                    val callsign = params["callsign"] ?: throw IllegalArgumentException("Callsign required")
                    val password = params["password"] ?: throw IllegalArgumentException("Password required")
                    
                    val result = transaction {
                        val existing = UserEntity.find { Users.email eq email }.firstOrNull()
                        if (existing != null) throw IllegalArgumentException("Email already registered")
                        
                        val user = UserEntity.new {
                            this.email = email
                            this.callsign = callsign
                            this.passwordHash = BCrypt.withDefaults().hashToString(12, password.toCharArray())
                            this.role = UserRole.USER
                        }
                        
                        val token = JWT.create()
                            .withIssuer("pttporto-api")
                            .withAudience("pttporto-app")
                            .withClaim("userId", user.id.value)
                            .withClaim("callsign", user.callsign)
                            .withExpiresAt(Date(System.currentTimeMillis() + 3600000))
                            .sign(Algorithm.HMAC256("secret"))
                        
                        Pair(token, user)
                    }
                    
                    call.respond(HttpStatusCode.Created, AuthResponse(result.first, result.second.id.value, result.second.callsign))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Registration failed")))
                }
            }
            
            post("/api/v1/auth/login") {
                try {
                    val params = call.receive<Map<String, String>>()
                    val email = params["email"] ?: throw IllegalArgumentException("Email required")
                    val password = params["password"] ?: throw IllegalArgumentException("Password required")
                    
                    val result = transaction {
                        val user = UserEntity.find { Users.email eq email }.firstOrNull()
                            ?: throw IllegalArgumentException("Invalid email or password")
                        
                        val verificationResult = BCrypt.verifyer().verify(password.toCharArray(), user.passwordHash)
                        if (!verificationResult.verified) {
                            throw IllegalArgumentException("Invalid email or password")
                        }
                        
                        val token = JWT.create()
                            .withIssuer("pttporto-api")
                            .withAudience("pttporto-app")
                            .withClaim("userId", user.id.value)
                            .withClaim("callsign", user.callsign)
                            .withExpiresAt(Date(System.currentTimeMillis() + 3600000))
                            .sign(Algorithm.HMAC256("secret"))
                        
                        Pair(token, user)
                    }
                    
                    call.respond(HttpStatusCode.OK, AuthResponse(result.first, result.second.id.value, result.second.callsign))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Login failed")))
                }
            }
            
            // Protected routes
            authenticate("auth-jwt") {
                // User endpoints
                get("/api/v1/users/me") {
                    val principal = call.principal<JWTPrincipal>()
                    val userId = principal?.payload?.getClaim("userId")?.asInt() ?: 0
                    
                    val user = transaction {
                        UserEntity.findById(userId)
                    }
                    
                    if (user != null) {
                        call.respond(HttpStatusCode.OK, UserResponse(user.id.value, user.email, user.callsign, user.role.name, user.totpEnabled))
                    } else {
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "User not found"))
                    }
                }
                
                get("/api/v1/users") {
                    try {
                        val users = transaction {
                            UserEntity.all().map { user ->
                                UserResponse(user.id.value, user.email, user.callsign, user.role.name, user.totpEnabled)
                            }
                        }
                        call.respond(HttpStatusCode.OK, users)
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Failed to list users")))
                    }
                }
                
                put("/api/v1/users/{id}") {
                    try {
                        val userId = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid user ID")
                        val params = call.receive<Map<String, String>>()
                        val role = params["role"]
                        val totpEnabled = params["totpEnabled"]?.toBoolean()
                        
                        transaction {
                            val user = UserEntity.findById(userId) ?: throw IllegalArgumentException("User not found")
                            role?.let { user.role = UserRole.valueOf(it) }
                            totpEnabled?.let { user.totpEnabled = it }
                        }
                        
                        val updatedUser = transaction {
                            val user = UserEntity.findById(userId)!!
                            UserResponse(user.id.value, user.email, user.callsign, user.role.name, user.totpEnabled)
                        }
                        
                        call.respond(HttpStatusCode.OK, updatedUser)
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Failed to update user")))
                    }
                }
                
                delete("/api/v1/users/{id}") {
                    try {
                        val userId = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid user ID")
                        
                        transaction {
                            val user = UserEntity.findById(userId) ?: throw IllegalArgumentException("User not found")
                            user.delete()
                        }
                        
                        call.respond(HttpStatusCode.OK, mapOf("message" to "User deleted"))
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Failed to delete user")))
                    }
                }
                
                // Channel routes
                post("/api/v1/channels") {
                    try {
                        val principal = call.principal<JWTPrincipal>()
                        val userId = principal?.payload?.getClaim("userId")?.asInt()
                            ?: throw IllegalArgumentException("User ID not found")
                        
                        val params = call.receive<Map<String, String>>()
                        val name = params["name"] ?: throw IllegalArgumentException("Channel name required")
                        val description = params["description"]
                        
                        val channelResponse = transaction {
                            val ch = ChannelEntity.new {
                                this.name = name
                                this.description = description
                                this.admin = UserEntity[userId]
                            }
                            
                            // Add creator as admin
                            ChannelMemberEntity.new {
                                this.channel = ch
                                this.user = UserEntity[userId]
                                this.role = ChannelRole.ADMIN
                            }
                            
                            ChannelResponse(
                                ch.id.value, 
                                ch.name, 
                                ch.description, 
                                ch.admin.id.value,
                                ch.admin.callsign,
                                1L,
                                "ADMIN"
                            )
                        }
                        
                        call.respond(HttpStatusCode.Created, channelResponse)
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Failed to create channel")))
                    }
                }
                
                get("/api/v1/channels") {
                    try {
                        val principal = call.principal<JWTPrincipal>()
                        val userId = principal?.payload?.getClaim("userId")?.asInt()
                        
                        val channels = transaction {
                            ChannelEntity.all().map { channel ->
                                val memberCount = ChannelMemberEntity.find { 
                                    ChannelMembers.channelId eq channel.id 
                                }.count()
                                
                                val userRole = if (userId != null) {
                                    ChannelMemberEntity.find { 
                                        ChannelMembers.channelId eq channel.id
                                    }.find { it.user.id.value == userId }?.role?.name
                                } else null
                                
                                ChannelResponse(
                                    channel.id.value, 
                                    channel.name, 
                                    channel.description, 
                                    channel.admin.id.value,
                                    channel.admin.callsign,
                                    memberCount,
                                    userRole
                                )
                            }
                        }
                        call.respond(HttpStatusCode.OK, channels)
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Failed to fetch channels"))
                    }
                }
                
                post("/api/v1/channels/{id}/join") {
                    try {
                        val principal = call.principal<JWTPrincipal>()
                        val userId = principal?.payload?.getClaim("userId")?.asInt()
                            ?: throw IllegalArgumentException("User ID not found")
                        val channelId = call.parameters["id"]?.toIntOrNull()
                            ?: throw IllegalArgumentException("Invalid channel ID")
                        
                        transaction {
                            val existing = ChannelMemberEntity.find { ChannelMembers.channelId eq channelId }
                                .find { it.user.id.value == userId }
                            if (existing != null) throw IllegalArgumentException("Already a member")
                            
                            ChannelMemberEntity.new {
                                this.channel = ChannelEntity[channelId]
                                this.user = UserEntity[userId]
                                this.role = ChannelRole.LISTENER
                            }
                        }
                        
                        call.respond(HttpStatusCode.Created, mapOf("message" to "Joined channel"))
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Failed to join channel")))
                    }
                }
                
                delete("/api/v1/channels/{id}/leave") {
                    try {
                        val principal = call.principal<JWTPrincipal>()
                        val userId = principal?.payload?.getClaim("userId")?.asInt()
                            ?: throw IllegalArgumentException("User ID not found")
                        val channelId = call.parameters["id"]?.toIntOrNull()
                            ?: throw IllegalArgumentException("Invalid channel ID")
                        
                        transaction {
                            val membership = ChannelMemberEntity.find { ChannelMembers.channelId eq channelId }
                                .find { it.user.id.value == userId }
                                ?: throw IllegalArgumentException("Not a member of this channel")
                            
                            // Don't allow admin to leave if they're the only admin
                            if (membership.role == ChannelRole.ADMIN) {
                                val adminCount = ChannelMemberEntity.find { 
                                    ChannelMembers.channelId eq channelId 
                                }.count { it.role == ChannelRole.ADMIN }
                                
                                if (adminCount <= 1) {
                                    throw IllegalArgumentException("Cannot leave - you are the only admin")
                                }
                            }
                            
                            membership.delete()
                        }
                        
                        call.respond(HttpStatusCode.OK, mapOf("message" to "Left channel"))
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Failed to leave channel")))
                    }
                }
                
                delete("/api/v1/channels/{id}") {
                    try {
                        val principal = call.principal<JWTPrincipal>()
                        val userId = principal?.payload?.getClaim("userId")?.asInt()
                            ?: throw IllegalArgumentException("User ID not found")
                        val channelId = call.parameters["id"]?.toIntOrNull()
                            ?: throw IllegalArgumentException("Invalid channel ID")
                        
                        transaction {
                            val channel = ChannelEntity.findById(channelId) ?: throw IllegalArgumentException("Channel not found")
                            
                            // Check if user is admin of this channel OR superadmin
                            val user = UserEntity.findById(userId!!) ?: throw IllegalArgumentException("User not found")
                            val membership = ChannelMemberEntity.find { ChannelMembers.channelId eq channelId }
                                .find { it.user.id.value == userId }
                            
                            if (membership?.role != ChannelRole.ADMIN && user.role != UserRole.SUPERADMIN) {
                                throw IllegalArgumentException("Only channel admins or superadmins can delete channels")
                            }
                            
                            // Delete channel members first
                            ChannelMemberEntity.find { ChannelMembers.channelId eq channelId }.forEach { it.delete() }
                            channel.delete()
                        }
                        
                         call.respond(HttpStatusCode.OK, mapOf("message" to "Channel deleted"))
                     } catch (e: Exception) {
                         call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Failed to delete channel")))
                     }
                 }
            }
            
             // WebSocket PTT endpoint - WebRTC signaling
             webSocket("/ws/ptt/{channelId}") {
                 val channelId = call.parameters["channelId"]?.toIntOrNull()
                 if (channelId == null) {
                     close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid channel ID"))
                     return@webSocket
                 }
                 
                 // Get JWT token from query parameter
                 val token = call.request.queryParameters["token"]
                 if (token == null) {
                     close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing token"))
                     return@webSocket
                 }
                 
                 // Verify JWT token
                 val jwtVerifier = com.auth0.jwt.JWT.require(com.auth0.jwt.algorithms.Algorithm.HMAC256("secret"))
                     .withIssuer("pttporto-api")
                     .withAudience("pttporto-app")
                     .build()
                 
                 val decodedJWT = try {
                     jwtVerifier.verify(token)
                 } catch (e: Exception) {
                     close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid token"))
                     return@webSocket
                 }
                 
                 val userId = decodedJWT.getClaim("userId")?.asInt()
                 val callsign = decodedJWT.getClaim("callsign")?.asString() ?: "Unknown"
                 
                  if (userId == null) {
                      close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Unauthorized"))
                      return@webSocket
                  }
                  
                  // Check channel membership
                  val isMember = withContext(Dispatchers.IO) {
                      transaction {
                          val members = ChannelMemberEntity.find { ChannelMembers.channelId eq channelId }
                          members.any { it.user.id.value == userId }
                      }
                  }
                  if (!isMember) {
                      close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Not a channel member"))
                      return@webSocket
                  }
                  
                   // Store connection in a shared map (in production, use Redis or similar)
                   val sessionId = "$userId-$channelId"
                   PTTWebSocketManager.addConnection(sessionId, this)
                   
                   // Get list of other users in channel
                   val usersInChannel = transaction {
                       ChannelMemberEntity.find { ChannelMembers.channelId eq channelId }
                           .filter { it.user.id.value != userId }
                           .map { it.user.id.value }
                   }
                   
                  try {
                      // Send confirmation with user list
                      val connectedMsg = org.json.JSONObject()
                      connectedMsg.put("type", "connected")
                      connectedMsg.put("userId", userId)
                      connectedMsg.put("callsign", callsign)
                      connectedMsg.put("channelId", channelId)
                      
                      val usersArray = org.json.JSONArray()
                      usersInChannel.forEach { uid ->
                          val userCallsign = transaction { UserEntity.findById(uid)?.callsign ?: "Unknown" }
                          val userObj = org.json.JSONObject()
                          userObj.put("userId", uid)
                          userObj.put("callsign", userCallsign)
                          usersArray.put(userObj)
                      }
                      connectedMsg.put("users", usersArray)
                      
                      send(Frame.Text(connectedMsg.toString()))
                      println("[WS] Sent user list to $userId: $usersInChannel")
                     
                     for (frame in incoming) {
                         when (frame) {
                             is Frame.Text -> {
                                 val message = frame.readText()
                                 try {
                                     val json = org.json.JSONObject(message)
                                     val type = json.getString("type")
                                     
                                     when (type) {
                                         "ptt-start" -> {
                                             // Broadcast to other users in channel
                                             val broadcastMessage = org.json.JSONObject()
                                             broadcastMessage.put("type", "ptt-start")
                                             broadcastMessage.put("userId", userId)
                                             broadcastMessage.put("callsign", callsign)
                                             broadcastMessage.put("channelId", channelId)
                                             runBlocking { PTTWebSocketManager.broadcastToChannel(channelId, userId, broadcastMessage.toString()) }
                                         }
                                         "ptt-stop" -> {
                                             val broadcastMessage = org.json.JSONObject()
                                             broadcastMessage.put("type", "ptt-stop")
                                             broadcastMessage.put("userId", userId)
                                             broadcastMessage.put("callsign", callsign)
                                             broadcastMessage.put("channelId", channelId)
                                             runBlocking { PTTWebSocketManager.broadcastToChannel(channelId, userId, broadcastMessage.toString()) }
                                         }
                                          "offer", "answer", "ice-candidate" -> {
                                              // Broadcast signaling to ALL users in channel (except sender)
                                              val broadcastMessage = org.json.JSONObject()
                                              broadcastMessage.put("type", type)
                                              broadcastMessage.put("userId", userId)
                                              broadcastMessage.put("callsign", callsign)
                                              broadcastMessage.put("payload", json.getJSONObject("payload"))
                                              runBlocking { PTTWebSocketManager.broadcastToChannel(channelId, userId, broadcastMessage.toString()) }
                                         }
                                     }
                                 } catch (e: Exception) {
                                     println("Error parsing message: ${e.message}")
                                 }
                             }
                             else -> {}
                         }
                     }
                 } catch (e: Exception) {
                     println("WebSocket error for $sessionId: ${e.message}")
                 } finally {
                     PTTWebSocketManager.removeConnection(sessionId)
                 }
              }
         }
    }.start(wait = true)
}

// WebSocket connection manager for PTT channels
object PTTWebSocketManager {
    private val connections = mutableMapOf<String, WebSocketServerSession>()
    private val channelMembers = mutableMapOf<Int, MutableSet<String>>()
    
    @Synchronized
    fun addConnection(sessionId: String, session: WebSocketServerSession) {
        connections[sessionId] = session
        val parts = sessionId.split("-")
        if (parts.size == 2) {
            val channelId = parts[1].toIntOrNull()
            if (channelId != null) {
                channelMembers.getOrPut(channelId) { mutableSetOf() }.add(sessionId)
            }
        }
    }
    
    @Synchronized
    fun removeConnection(sessionId: String) {
        connections.remove(sessionId)
        val parts = sessionId.split("-")
        if (parts.size == 2) {
            val channelId = parts[1].toIntOrNull()
            if (channelId != null) {
                channelMembers[channelId]?.remove(sessionId)
                if (channelMembers[channelId]?.isEmpty() == true) {
                    channelMembers.remove(channelId)
                }
            }
        }
    }
    
    suspend fun broadcastToChannel(channelId: Int, excludeUserId: Int, message: String) {
        val sessions = channelMembers[channelId] ?: return
        val excludeSessionId = "$excludeUserId-$channelId"
        sessions.forEach { sessionId ->
            if (sessionId != excludeSessionId) {
                connections[sessionId]?.send(Frame.Text(message))
            }
        }
    }
    
    suspend fun sendToUser(targetUserId: Int, channelId: Int, message: String) {
        val sessionId = "$targetUserId-$channelId"
        connections[sessionId]?.send(Frame.Text(message))
    }
}
