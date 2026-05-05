package com.pttporto.ui.ptt

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun PTTScreen(
    channelId: Int,
    onBack: () -> Unit,
    viewModel: PTTViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    DisposableEffect(channelId) {
        viewModel.connectWebSocket(channelId)
        onDispose {
            viewModel.disconnect()
        }
    }
    
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Start
        ) {
            Button(onClick = onBack) {
                Text("Back")
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Text(
            text = "Channel: ${uiState.channelName}",
            style = MaterialTheme.typography.headlineMedium
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Status display
        Card(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = when {
                        uiState.isTransmitting -> "TRANSMITTING"
                        uiState.isReceiving -> "RECEIVING: ${uiState.activeCallerCallsign}"
                        else -> "Ready"
                    },
                    style = MaterialTheme.typography.titleLarge,
                    color = when {
                        uiState.isTransmitting -> MaterialTheme.colorScheme.error
                        uiState.isReceiving -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.onSurface
                    }
                )
                
                if (uiState.statusMessage.isNotBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = uiState.statusMessage,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.weight(1f))
        
        // PTT Button
        Button(
            onClick = { },
            modifier = Modifier.size(200.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (uiState.isTransmitting) 
                    MaterialTheme.colorScheme.error 
                else 
                    MaterialTheme.colorScheme.primary
            ),
            interactionSource = remember { NoRippleInteractionSource() }
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = if (uiState.isTransmitting) "TALKING..." else "PTT",
                    style = MaterialTheme.typography.headlineLarge
                )
                Text(
                    text = "Press and hold to talk",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))
    }
}

// Custom interaction source to disable ripple effect
class NoRippleInteractionSource : androidx.compose.foundation.interaction.MutableInteractionSource {
    override val interactions: kotlinx.coroutines.flow.Flow<androidx.compose.foundation.interaction.Interaction> =
        kotlinx.coroutines.flow.emptyFlow()
    
    override suspend fun emit(interaction: androidx.compose.foundation.interaction.Interaction) {}
    override fun tryEmit(interaction: androidx.compose.foundation.interaction.Interaction): Boolean = true
}
