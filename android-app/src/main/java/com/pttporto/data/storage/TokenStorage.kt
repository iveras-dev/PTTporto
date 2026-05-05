package com.pttporto.data.storage

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore by preferencesDataStore(name = "pttporto_prefs")

object PreferencesKeys {
    val ACCESS_TOKEN = stringPreferencesKey("access_token")
    val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
    val USER_ID = intPreferencesKey("user_id")
    val CALLSIGN = stringPreferencesKey("callsign")
    val USER_ROLE = stringPreferencesKey("user_role")
}

class TokenStorage(private val context: Context) {
    
    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        context.dataStore.edit { prefs ->
            prefs[PreferencesKeys.ACCESS_TOKEN] = accessToken
            prefs[PreferencesKeys.REFRESH_TOKEN] = refreshToken
        }
    }
    
    suspend fun saveUserInfo(userId: Int, callsign: String, role: String) {
        context.dataStore.edit { prefs ->
            prefs[PreferencesKeys.USER_ID] = userId
            prefs[PreferencesKeys.CALLSIGN] = callsign
            prefs[PreferencesKeys.USER_ROLE] = role
        }
    }
    
    val accessToken: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[PreferencesKeys.ACCESS_TOKEN]
    }
    
    val isLoggedIn: Flow<Boolean> = context.dataStore.data.map { prefs ->
        !prefs[PreferencesKeys.ACCESS_TOKEN].isNullOrEmpty()
    }
    
    suspend fun clearAll() {
        context.dataStore.edit { it.clear() }
    }
}
