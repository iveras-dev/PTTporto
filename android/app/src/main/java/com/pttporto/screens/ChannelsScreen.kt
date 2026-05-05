package com.pttporto.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.pttporto.network.ApiService
import com.pttporto.network.ChannelResponse
import com.pttporto.data.TokenStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun ChannelsScreen(navController: NavController) {
    val context = LocalContext.current
    var channels by remember { mutableStateOf(listOf<ChannelResponse>()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var showCreateDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    
    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val token = TokenStore.getToken(context).first()
                if (token != null) {
                    channels = ApiService.getChannels(token)
                } else {
                    navController.navigate("login") {
                        popUpTo("channels") { inclusive = true }
                    }
                }
            } catch (e: Exception) {
                error = e.message ?: "Failed to load channels"
            } finally {
                isLoading = false
            }
        }
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Channels", style = MaterialTheme.typography.headlineMedium)
            Button(onClick = { showCreateDialog = true }) {
                Text("Create")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
        } else if (error.isNotEmpty()) {
            Text(error, color = MaterialTheme.colorScheme.error)
        } else {
            LazyColumn {
                items(channels) { channel ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp)
                        ) {
                            Text(channel.name, style = MaterialTheme.typography.titleMedium)
                            channel.description?.let {
                                Text(it, style = MaterialTheme.typography.bodyMedium)
                            }
                            Text("Members: ${channel.memberCount}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
    
    if (showCreateDialog) {
        CreateChannelDialog(context, onDismiss = { showCreateDialog = false }, onCreated = { showCreateDialog = false })
    }
}

@Composable
fun CreateChannelDialog(context: Context, onDismiss: () -> Unit, onCreated: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Channel") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth()
                )
                if (error.isNotEmpty()) {
                    Text(error, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    scope.launch {
                        try {
                            val token = TokenStore.getToken(context).first()
                            if (token != null) {
                                ApiService.createChannel(name, description, token)
                                onCreated()
                            }
                        } catch (e: Exception) {
                            error = e.message ?: "Failed to create channel"
                        }
                    }
                }
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
