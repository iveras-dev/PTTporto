package com.pttporto.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController

@Composable
fun PTTScreen(navController: NavController, channelId: Int) {
    var isTransmitting by remember { mutableStateOf(false) }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("PTT Channel #$channelId", style = MaterialTheme.typography.headlineMedium)
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Button(
            onClick = { isTransmitting = !isTransmitting },
            modifier = Modifier.size(200.dp),
            colors = if (isTransmitting) 
                ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error) 
            else 
                ButtonDefaults.buttonColors()
        ) {
            Text(
                if (isTransmitting) "Transmitting..." else "Push to Talk",
                modifier = Modifier.padding(16.dp)
            )
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            if (isTransmitting) "Release to stop" else "Press and hold to transmit",
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
