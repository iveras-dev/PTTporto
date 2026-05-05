package com.pttporto.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.pttporto.ui.auth.LoginScreen
import com.pttporto.ui.auth.RegisterScreen
import com.pttporto.ui.channels.ChannelListScreen
import com.pttporto.ui.ptt.PTTScreen
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNavigation()
                }
            }
        }
    }
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    
    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(
                onLoginSuccess = { navController.navigate("channels") },
                onNavigateToRegister = { navController.navigate("register") }
            )
        }
        composable("register") {
            RegisterScreen(
                onRegisterSuccess = { navController.navigate("channels") },
                onNavigateToLogin = { navController.popBackStack() }
            )
        }
        composable("channels") {
            ChannelListScreen(
                navController = navController
            )
        }
        composable("ptt/{channelId}") { backStackEntry ->
            val channelId = backStackEntry.arguments?.getString("channelId")?.toIntOrNull()
            channelId?.let {
                PTTScreen(
                    channelId = it,
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}
        composable("register") {
            RegisterScreen(
                onRegisterSuccess = { navController.navigate("channels") },
                onNavigateToLogin = { navController.popBackStack() }
            )
        }
  composable("ptt/{channelId}") { backStackEntry ->
    val channelId = backStackEntry.arguments?.getString("channelId")?.toIntOrNull()
    channelId?.let {
      PTTSCreen(
        channelId = it,
        onBack = { navController.popBackStack() }
      )
    }
  }
    }
}
