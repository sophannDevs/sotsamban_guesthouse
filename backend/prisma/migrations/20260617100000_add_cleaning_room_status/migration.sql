-- Add CLEANING value to RoomStatus enum
ALTER TYPE "RoomStatus" ADD VALUE IF NOT EXISTS 'CLEANING';
