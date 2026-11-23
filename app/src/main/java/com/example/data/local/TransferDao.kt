package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface TransferDao {
    @Query("SELECT * FROM sms_records ORDER BY timestampMillis DESC")
    fun observeSmsRecords(): Flow<List<SmsRecordEntity>>

    @Query("SELECT * FROM call_records ORDER BY timestampMillis DESC")
    fun observeCallRecords(): Flow<List<CallRecordEntity>>

    @Query("SELECT * FROM contacts ORDER BY isFavorite DESC, displayName ASC")
    fun observeContacts(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM transfer_history ORDER BY timestampMillis DESC")
    fun observeTransferHistory(): Flow<List<TransferHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSms(record: SmsRecordEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSmsList(records: List<SmsRecordEntity>)

    @Query("UPDATE sms_records SET isRead = 1 WHERE phoneNumber = :phoneNumber")
    suspend fun markThreadRead(phoneNumber: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCall(record: CallRecordEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCallList(records: List<CallRecordEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertContact(contact: ContactEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertContacts(contacts: List<ContactEntity>)

    @Update
    suspend fun updateContact(contact: ContactEntity)

    @Query("SELECT * FROM contacts WHERE phoneNumber = :phone LIMIT 1")
    suspend fun findContactByPhone(phone: String): ContactEntity?

    @Query("UPDATE contacts SET isFavorite = :favorite WHERE id = :id")
    suspend fun setContactFavorite(id: Long, favorite: Boolean)

    @Query("UPDATE contacts SET syncedToSystem = :synced WHERE id = :id")
    suspend fun setContactSyncedToSystem(id: Long, synced: Boolean)

    @Query("DELETE FROM contacts WHERE id = :id")
    suspend fun deleteContact(id: Long)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHistory(entry: TransferHistoryEntity): Long

    @Query("UPDATE sms_records SET isSelected = :selected WHERE id = :id")
    suspend fun setSmsSelected(id: Long, selected: Boolean)

    @Query("UPDATE call_records SET isSelected = :selected WHERE id = :id")
    suspend fun setCallSelected(id: Long, selected: Boolean)

    @Query("UPDATE sms_records SET isSelected = :selected")
    suspend fun setAllSmsSelected(selected: Boolean)

    @Query("UPDATE call_records SET isSelected = :selected")
    suspend fun setAllCallsSelected(selected: Boolean)

    @Query("DELETE FROM sms_records WHERE id = :id")
    suspend fun deleteSms(id: Long)

    @Query("DELETE FROM sms_records WHERE phoneNumber = :phoneNumber")
    suspend fun deleteSmsThread(phoneNumber: String)

    @Query("DELETE FROM call_records WHERE id = :id")
    suspend fun deleteCall(id: Long)

    @Query("DELETE FROM sms_records")
    suspend fun clearAllSms()

    @Query("DELETE FROM call_records")
    suspend fun clearAllCalls()

    @Query("DELETE FROM transfer_history WHERE id = :id")
    suspend fun deleteHistory(id: Long)

    @Query("DELETE FROM transfer_history")
    suspend fun clearAllHistory()
}
