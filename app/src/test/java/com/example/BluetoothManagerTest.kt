package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.bluetooth.BleRelayFramer
import com.example.bluetooth.BluetoothManager
import com.example.bluetooth.BridgeCrypto
import com.example.data.model.RelayConnectionState
import com.example.data.model.RelayDeviceRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class BluetoothManagerTest {

    @Test
    fun `device role defaults to primary and switches to secondary`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val manager = BluetoothManager(context)
        try {
            assertEquals(RelayDeviceRole.PRIMARY, manager.deviceRole.value)
            assertEquals(RelayConnectionState.Disconnected, manager.connectionState.value)

            manager.setDeviceRole(RelayDeviceRole.SECONDARY)
            assertEquals(RelayDeviceRole.SECONDARY, manager.deviceRole.value)
        } finally {
            manager.release()
        }
    }

    @Test
    fun `ble relay framer splits and reassembles utf8 payload across small mtu chunks`() {
        val original = """{"app":"eSkyTell","bridgeType":"SMS_RELAY","contactName":"مهدی رضایی","phoneNumber":"+989121112233","messageBody":"سلام، این یک پیام آزمایشی برای تست رله چندبخشی BLE GATT است."}"""
        val bytes = original.toByteArray(Charsets.UTF_8)

        val frames = BleRelayFramer.encodeChunks(
            payloadBytes = bytes,
            maxAttPayloadBytes = 20,
            messageId = 42
        )
        assertTrue("Expected multiple BLE frames for MTU=20", frames.size > 5)
        assertTrue(frames.all { it.size <= 20 })

        val reassembler = BleRelayFramer.ReassemblyBuffer()
        // Deliver frames out of order to verify sequence-index reassembly
        val shuffled = frames.reversed()
        var completed: String? = null
        shuffled.forEachIndexed { idx, frame ->
            val result = reassembler.accept("AA:BB:CC:DD:EE:FF", frame)
            if (idx < shuffled.lastIndex) {
                assertNull("Should wait until all chunks arrive", result)
            } else {
                completed = result
            }
        }
        assertEquals(original, completed)
    }

    @Test
    fun `ble relay reassembler passes through unframed json packets`() {
        val rawJson = """{"app":"eSkyTell","bridgeType":"CALL_TRANSFER","phoneNumber":"09120000000"}"""
        val reassembler = BleRelayFramer.ReassemblyBuffer()
        val decoded = reassembler.accept("11:22:33:44:55:66", rawJson.toByteArray(Charsets.UTF_8))
        assertEquals(rawJson, decoded)
    }

    @Test
    fun `relayData fails gracefully when disconnected without target device`() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val manager = BluetoothManager(context)
        try {
            val result = manager.relayData(payload = """{"ping":1}""")
            assertTrue(result.isFailure)
        } finally {
            manager.release()
        }
    }

    @Test
    fun `encrypted envelope fragments and reassembles cleanly`() {
        val pin = "482910"
        val plain = """{"app":"eSkyTell","bridgeType":"SMS_RELAY","messageBody":"تست رمزنگاری رله"}"""
        val encrypted = BridgeCrypto.encryptEnvelope(plain, pin)
        val frames = BleRelayFramer.encodeChunks(encrypted.toByteArray(Charsets.UTF_8), maxAttPayloadBytes = 64)
        val reassembler = BleRelayFramer.ReassemblyBuffer()
        var reassembled: String? = null
        frames.forEach { frame ->
            reassembled = reassembler.accept("PEER-1", frame)
        }
        assertEquals(encrypted, reassembled)
        assertEquals(plain, BridgeCrypto.decryptEnvelopeIfNeeded(reassembled!!, pin))
    }
}
