import mongoose from "mongoose";

const verificationRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userType: {
        type: String,
        enum: ['donor', 'fundraiser'],
        required: true
    },
    identityType: {
        type: String, // 'NID', 'Passport', 'Driving License', 'Other'
        required: true
    },
    identityNumber: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    documents: [{
        type: { type: String, required: true }, // 'id_front', 'id_back', etc.
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
    }],
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'approved', 'rejected'],
        default: 'pending'
    },
    adminMessage: {
        type: String,
        default: ''
    },
    reviewedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    reviewedAt: Date
}, { timestamps: true });

// Ensure unique pending request per user
verificationRequestSchema.index({ user: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

const VerificationRequest = mongoose.model('VerificationRequest', verificationRequestSchema);

export default VerificationRequest;
