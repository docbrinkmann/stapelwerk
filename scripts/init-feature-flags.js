const redis = require('redis');

async function initializeFeatureFlags() {
    const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    await client.connect();
    
    // Set production feature flags to 100%
    await client.set('feature:ai_recommendations:percentage', '100');
    await client.set('feature:template_system:percentage', '100');
    await client.set('feature:real_time_updates:percentage', '100');
    await client.set('feature:community_templates:percentage', '100');
    
    console.log('Production feature flags initialized to 100%');
    
    await client.disconnect();
}

initializeFeatureFlags().catch(console.error);
