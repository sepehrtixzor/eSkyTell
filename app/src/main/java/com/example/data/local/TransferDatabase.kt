package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        SmsRecordEntity::class,
        CallRecordEntity::class,
        ContactEntity::class,
        TransferHistoryEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class TransferDatabase : RoomDatabase() {
    abstract fun transferDao(): TransferDao

    companion object {
        @Volatile
        private var INSTANCE: TransferDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `contacts` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `displayName` TEXT NOT NULL,
                        `phoneNumber` TEXT NOT NULL,
                        `email` TEXT NOT NULL,
                        `notes` TEXT NOT NULL,
                        `isFavorite` INTEGER NOT NULL,
                        `syncedToSystem` INTEGER NOT NULL,
                        `sourceLabel` TEXT NOT NULL,
                        `updatedAtMillis` INTEGER NOT NULL
                    )
                    """.trimIndent()
                )
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `sms_records` ADD COLUMN `simSlot` INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE `sms_records` ADD COLUMN `isRead` INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE `call_records` ADD COLUMN `simSlot` INTEGER NOT NULL DEFAULT 1")
            }
        }

        fun getInstance(context: Context): TransferDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    TransferDatabase::class.java,
                    "eskytell_bridge_db"
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
