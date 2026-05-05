package com.pttporto.network

import io.ktor.client.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

object NetworkClient {
    val client = HttpClient(io.ktor.client.engine.android.Android) {
        install(ContentNegotiation) {
            json(Json {
                prettyPrint = true
                isLenient = true
                ignoreUnknownKeys = true
            })
        }
        
        install(Logging) {
            logger = Logger.DEFAULT
            level = LogLevel.ALL
        }
        
        install(HttpTimeout) {
            requestTimeoutMillis = 30000
        }
        
        defaultRequest {
            host = "10.0.2.2"  // Android emulator localhost
            port = 8082
            url {
                protocol = io.ktor.http.URLProtocol.HTTP
            }
        }
    }
}
