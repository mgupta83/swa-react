const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");

// Global instances cached across execution hot-starts
let client = null;
const secretCache = {}; 

// Cache configuration (5 minutes in milliseconds)
const CACHE_TTL_MS = 5 * 60 * 1000; 

function getSecretClient() {
    if (!client) {
        const vaultUrl = process.env.KEY_VAULT_URL;
        if (!vaultUrl) {
            throw new Error("Configuration Error: KEY_VAULT_URL environment variable is missing.");
        }
        const credential = new DefaultAzureCredential();
        client = new SecretClient(vaultUrl, credential);
    }
    return client;
}

/**
 * Fetches a secret value from Azure Key Vault with in-memory caching.
 * @param {string} secretName - The name of the secret to retrieve.
 * @returns {Promise<string>} The secret value string.
 */
async function getSecret(secretName) {
    const now = Date.now();
    const cachedItem = secretCache[secretName];

    // Return the cached secret if it exists and hasn't expired
    if (cachedItem && (now - cachedItem.timestamp < CACHE_TTL_MS)) {
        return cachedItem.value;
    }

    try {
        const secretClient = getSecretClient();
        const secret = await secretClient.getSecret(secretName);
        
        // Update the in-memory cache
        secretCache[secretName] = {
            value: secret.value,
            timestamp: now
        };

        return secret.value;
    } catch (error) {
        // Fallback: If Key Vault fails (e.g. rate limits), return expired cache if available
        if (cachedItem) {
            return cachedItem.value;
        }
        throw new Error(`Failed to retrieve secret '${secretName}': ${error.message}`);
    }
}

module.exports = { getSecret };
