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
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import java.util.*

fun main() {
    embeddedServer(Netty, port = 8082) {
        install(ContentNegotiation) {
            json()
        }
        
        install(Authentication) {
            jwt("auth-jwt") {
                realm = "pttporto"
                verifier(
                    JWT.require(Algorithm.HMAC256("secret"))
                        .withIssuer("pttporto-api")
                        .withAudience("pttporto-app")
                        .build()
                )
                validate { credential ->
                    if (credential.payload.audience.contains("pttporto-app")) {
                        JWTPrincipal(credential.payload)
                    } else null
                }
            }
        }
        
        routing {
            get("/health") {
                call.respond(mapOf("status" to "ok"))
            }
            
            post("/api/v1/auth/register") {
                try {
                    val params = call.receive<Map<String, String>>()
                    val email = params["email"] ?: throw IllegalArgumentException("Email required")
                    val callsign = params["callsign"] ?: throw IllegalArgumentException("Callsign required")
                    val password = params["password"] ?: throw IllegalArgumentException("Password required")
                    
                    val token = JWT.create()
                        .withIssuer("pttporto-api")
                        .withAudience("pttporto-app")
                        .withClaim("userId", 1)
                        .withClaim("callsign", callsign)
                        .withExpiresAt(Date(System.currentTimeMillis() + 3600000))
                        .sign(Algorithm.HMAC256("secret"))
                    
                    call.respond(HttpStatusCode.Created, mapOf(
                        "accessToken" to token,
                        "userId" to 1,
                        "callsign" to callsign
                    ))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Registration failed")))
                }
            }
            
            post("/api/v1/auth/login") {
                try {
                    val params = call.receive<Map<String, String>>()
                    val email = params["email"] ?: throw IllegalArgumentException("Email required")
                    val password = params["password"] ?: throw IllegalArgumentException("Password required")
                    
                    val token = JWT.create()
                        .withIssuer("pttporto-api")
                        .withAudience("pttporto-app")
                        .withClaim("userId", 1)
                        .withClaim("callsign", "TEST1")
                        .withExpiresAt(Date(System.currentTimeMillis() + 3600000))
                        .sign(Algorithm.HMAC256("secret"))
                    
                    call.respond(HttpStatusCode.OK, mapOf(
                        "accessToken" to token,
                        "userId" to 1,
                        "callsign" to "TEST1"
                    ))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Login failed")))
                }
            }
            
            authenticate("auth-jwt") {
                get("/api/v1/users/me") {
                    val principal = call.principal<JWTPrincipal>()
                    val userId = principal?.payload?.getClaim("userId")?.asInt() ?: 0
                    val callsign = principal?.payload?.getClaim("callsign")?.asString() ?: ""
                    
                    call.respond(HttpStatusCode.OK, mapOf(
                        "id" to userId,
                        "callsign" to callsign
                    ))
                }
            }
        }
    }.start(wait = true)
}
