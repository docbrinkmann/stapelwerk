# BuildMyStack AI-Powered Recommendations - Technical Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Components](#architecture-components)
3. [AI/ML System Design](#aiml-system-design)
4. [Database Architecture](#database-architecture)
5. [API Architecture](#api-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [Infrastructure Architecture](#infrastructure-architecture)
8. [Security Architecture](#security-architecture)
9. [Performance Architecture](#performance-architecture)
10. [Monitoring and Observability](#monitoring-and-observability)

## System Overview

BuildMyStack AI-Powered Recommendations is an intelligent technology stack recommendation platform that uses advanced machine learning algorithms to provide personalized technology recommendations based on user preferences, project requirements, and community feedback.

### Key Capabilities
- **AI-Powered Recommendations**: Collaborative filtering and content-based recommendation engine
- **Real-time Personalization**: Dynamic adaptation to user behavior and preferences
- **Template Intelligence**: AI-curated template recommendations with community feedback
- **Real-time Updates**: Live recommendation updates with WebSocket connections
- **Advanced Analytics**: Comprehensive user behavior analysis and insights

### Technology Stack
- **Frontend**: Next.js 14.2+, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js 20, tRPC, Prisma ORM
- **Database**: PostgreSQL 18-alpine with performance indexing
- **Cache Layer**: Redis 7-alpine
- **AI/ML**: Python, scikit-learn, collaborative filtering algorithms
- **Infrastructure**: Docker Compose, Kubernetes, Nginx reverse proxy
- **Monitoring**: Prometheus, Grafana with custom dashboards
- **Security**: Docker Secrets, security headers (CSP, HSTS, X-Frame-Options)
- **Deployment**: CI/CD with GitLab CI/CD, Vercel hosting, feature flags with Redis

## Architecture Components

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Mobile App    │    │   Admin Panel   │
│   (Next.js)     │    │   (React Native)│    │   (React)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────────────┐
         │                API Gateway / Load Balancer              │
         │                     (Nginx/Ingress)                    │
         └─────────────────────────────────────────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────────────┐
         │                   tRPC API Layer                       │
         │              (Type-safe API Endpoints)                 │
         └─────────────────────────────────────────────────────────┘
                                 │
    ┌────────────────┬───────────┼───────────┬────────────────┐
    │                │           │           │                │
┌───▼────┐  ┌────▼────┐  ┌───▼────┐  ┌───▼────┐  ┌────▼────┐
│Auth    │  │Recommend│  │Template│  │Analytics│  │Real-time│
│Service │  │Engine   │  │Service │  │Service  │  │Updates  │
└────────┘  └─────────┘  └────────┘  └─────────┘  └─────────┘
    │            │           │           │           │
    └────────────┼───────────┼───────────┼───────────┘
                 │           │           │
         ┌───────▼───────────▼───────────▼───────┐
         │           Data Layer                  │
         │    PostgreSQL + Redis + Analytics     │
         └───────────────────────────────────────┘
```

### Core Services

#### 1. Authentication Service
- **Technology**: NextAuth.js with JWT tokens
- **Features**: OAuth integration, session management, role-based access control
- **Security**: Secure session storage, CSRF protection, rate limiting

#### 2. Recommendation Engine Service
- **Technology**: Python-based ML service with REST API
- **Algorithms**: Collaborative filtering, content-based filtering, hybrid approaches
- **Features**: Real-time personalization, A/B testing, feedback learning

#### 3. Template Service
- **Technology**: Node.js with tRPC
- **Features**: Template management, version control, community ratings
- **Caching**: Redis-based caching for performance optimization

#### 4. Analytics Service  
- **Technology**: Python data processing with PostgreSQL
- **Features**: User behavior tracking, cohort analysis, funnel analytics
- **Storage**: Time-series data in PostgreSQL with appropriate indexing

#### 5. Real-time Updates Service
- **Technology**: WebSocket-based with Socket.io
- **Features**: Live recommendation updates, user activity streams
- **Scaling**: Horizontal scaling with Redis for session storage

## AI/ML System Design

### Recommendation Engine Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   ML Pipeline Overview                       │
├─────────────────────────────────────────────────────────────┤
│  Data Collection → Feature Engineering → Model Training      │
│      ↓                    ↓                    ↓            │
│  User Behavior      User Preferences     Recommendation     │
│  Stack Usage        Content Features     Model Updates      │
│  Template Ratings   Technology Tags      A/B Test Results   │
└─────────────────────────────────────────────────────────────┘
```

#### Data Sources
1. **User Interaction Data**
   - Stack creation and modification events
   - Template usage and ratings
   - Technology selection patterns
   - Time spent on recommendations

2. **Content Features**
   - Technology compatibility matrices
   - Template metadata and descriptions
   - Community ratings and feedback
   - Performance characteristics

3. **Contextual Information**
   - Project requirements and constraints
   - User experience level and preferences
   - Team size and collaboration needs
   - Deployment environment preferences

#### ML Algorithms

##### 1. Collaborative Filtering
```python
# User-Item Matrix
users_items_matrix = [
    [rating_user1_item1, rating_user1_item2, ...],
    [rating_user2_item1, rating_user2_item2, ...],
    ...
]

# Similarity calculation using cosine similarity
def calculate_user_similarity(user1, user2):
    return cosine_similarity([user1], [user2])[0][0]

# Recommendation generation
def get_collaborative_recommendations(user_id, k_neighbors=50):
    similar_users = find_k_most_similar_users(user_id, k_neighbors)
    recommendations = aggregate_ratings_from_similar_users(similar_users)
    return recommendations
```

##### 2. Content-Based Filtering
```python
# Technology feature vectors
tech_features = {
    'react': [1, 0, 1, 0, 1],      # [frontend, backend, spa, api, component]
    'node.js': [0, 1, 0, 1, 0],    # based framework features
    'python': [0, 1, 0, 1, 0],
    # ... more technologies
}

# Content similarity calculation
def calculate_content_similarity(tech1, tech2):
    return cosine_similarity([tech_features[tech1]], [tech_features[tech2]])[0][0]

# Content-based recommendations
def get_content_recommendations(user_preferences):
    recommendations = []
    for tech in technology_catalog:
        similarity = calculate_preference_similarity(user_preferences, tech)
        recommendations.append((tech, similarity))
    return sorted(recommendations, key=lambda x: x[1], reverse=True)
```

##### 3. Hybrid Recommendation System
```python
def get_hybrid_recommendations(user_id, context, weights=[0.6, 0.4]):
    collaborative_recs = get_collaborative_recommendations(user_id)
    content_recs = get_content_recommendations(get_user_preferences(user_id))
    
    # Weighted combination
    hybrid_scores = {}
    for tech, score in collaborative_recs:
        hybrid_scores[tech] = weights[0] * score
    
    for tech, score in content_recs:
        if tech in hybrid_scores:
            hybrid_scores[tech] += weights[1] * score
        else:
            hybrid_scores[tech] = weights[1] * score
    
    return sorted(hybrid_scores.items(), key=lambda x: x[1], reverse=True)
```

#### Real-time Learning System
```python
class OnlineLearningSystem:
    def __init__(self):
        self.learning_rate = 0.01
        self.decay_factor = 0.95
        
    def update_user_preferences(self, user_id, interaction_data):
        """Update user preferences based on real-time interactions"""
        current_preferences = get_user_preferences(user_id)
        new_signals = extract_preference_signals(interaction_data)
        
        # Exponential moving average update
        updated_preferences = {}
        for pref_key, current_value in current_preferences.items():
            if pref_key in new_signals:
                updated_preferences[pref_key] = (
                    self.decay_factor * current_value + 
                    (1 - self.decay_factor) * new_signals[pref_key]
                )
            else:
                updated_preferences[pref_key] = current_value
        
        save_user_preferences(user_id, updated_preferences)
        
    def feedback_learning(self, recommendation_id, feedback_type, user_id):
        """Learn from explicit user feedback"""
        feedback_weight = {
            'positive': 1.0,
            'negative': -0.5,
            'neutral': 0.0
        }
        
        recommendation_data = get_recommendation_data(recommendation_id)
        weight = feedback_weight.get(feedback_type, 0.0)
        
        # Update recommendation model weights
        self.update_model_weights(recommendation_data, weight, user_id)
```

## Database Architecture

### PostgreSQL Schema Design

#### Core Tables

```sql
-- Users table with preference storage
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    experience_level VARCHAR(50) DEFAULT 'intermediate',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stacks table for user-created technology stacks
CREATE TABLE stacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    technologies JSONB NOT NULL DEFAULT '[]',
    requirements JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Technologies catalog with features and metadata
CREATE TABLE technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    features JSONB DEFAULT '{}',
    compatibility_matrix JSONB DEFAULT '{}',
    popularity_score DECIMAL(5,2) DEFAULT 0.0,
    learning_curve VARCHAR(50) DEFAULT 'medium',
    documentation_quality INTEGER DEFAULT 5,
    community_size INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table for pre-built stack templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    technologies JSONB NOT NULL,
    use_cases JSONB DEFAULT '[]',
    difficulty_level VARCHAR(50) DEFAULT 'intermediate',
    estimated_setup_time INTEGER, -- in minutes
    rating DECIMAL(3,2) DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    is_official BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User interactions for ML training
CREATE TABLE user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interaction_type VARCHAR(100) NOT NULL, -- 'view', 'click', 'select', 'rate'
    target_type VARCHAR(50) NOT NULL, -- 'technology', 'template', 'stack'
    target_id UUID NOT NULL,
    context JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for ML queries
    INDEX idx_interactions_user_time (user_id, timestamp DESC),
    INDEX idx_interactions_target (target_type, target_id),
    INDEX idx_interactions_session (session_id)
);

-- Recommendations table for tracking and analytics
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(100) NOT NULL,
    recommended_items JSONB NOT NULL,
    algorithm_used VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(5,4),
    context JSONB DEFAULT '{}',
    shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clicked_at TIMESTAMP WITH TIME ZONE,
    feedback VARCHAR(50), -- 'positive', 'negative', 'neutral'
    feedback_at TIMESTAMP WITH TIME ZONE
);

-- Analytics tables for performance monitoring
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    page_url TEXT,
    user_agent TEXT,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partitioning by date for performance
    PARTITION BY RANGE (timestamp)
);

-- Create monthly partitions for analytics
CREATE TABLE analytics_events_2025_09 PARTITION OF analytics_events
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
```

#### Indexing Strategy

```sql
-- Performance optimization indexes
CREATE INDEX CONCURRENTLY idx_users_email_hash ON users USING hash(email);
CREATE INDEX CONCURRENTLY idx_stacks_user_created ON stacks(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_technologies_category ON technologies(category, subcategory);
CREATE INDEX CONCURRENTLY idx_templates_rating_usage ON templates(rating DESC, usage_count DESC);

-- JSONB indexes for advanced queries
CREATE INDEX CONCURRENTLY idx_users_preferences ON users USING gin(preferences);
CREATE INDEX CONCURRENTLY idx_stacks_technologies ON stacks USING gin(technologies);
CREATE INDEX CONCURRENTLY idx_technologies_features ON technologies USING gin(features);
CREATE INDEX CONCURRENTLY idx_recommendations_items ON recommendations USING gin(recommended_items);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY idx_technologies_search ON technologies 
    USING gin(to_tsvector('english', name || ' ' || description));
CREATE INDEX CONCURRENTLY idx_templates_search ON templates 
    USING gin(to_tsvector('english', name || ' ' || description));
```

### Redis Architecture

#### Caching Strategy
```javascript
// Redis key patterns and expiration times
const CACHE_PATTERNS = {
    USER_PREFERENCES: 'user:prefs:{userId}',     // TTL: 1 hour
    USER_RECOMMENDATIONS: 'user:recs:{userId}',  // TTL: 30 minutes
    TEMPLATE_CACHE: 'template:{templateId}',     // TTL: 24 hours
    TECHNOLOGY_CACHE: 'tech:{techId}',          // TTL: 24 hours
    FEATURE_FLAGS: 'feature:{flagName}',         // TTL: 5 minutes
    SESSION_DATA: 'session:{sessionId}',         // TTL: 24 hours
    RATE_LIMIT: 'rate:{userId}:{endpoint}',      // TTL: 1 hour
};

// Caching implementation example
class CacheService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.defaultTTL = 3600; // 1 hour
    }
    
    async getUserRecommendations(userId) {
        const cacheKey = CACHE_PATTERNS.USER_RECOMMENDATIONS.replace('{userId}', userId);
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        // Generate fresh recommendations
        const recommendations = await this.recommendationEngine.generate(userId);
        
        // Cache with TTL
        await this.redis.setex(cacheKey, 1800, JSON.stringify(recommendations)); // 30 min
        
        return recommendations;
    }
    
    async invalidateUserCache(userId) {
        const patterns = [
            CACHE_PATTERNS.USER_PREFERENCES.replace('{userId}', userId),
            CACHE_PATTERNS.USER_RECOMMENDATIONS.replace('{userId}', userId),
        ];
        
        await Promise.all(patterns.map(pattern => this.redis.del(pattern)));
    }
}
```

## API Architecture

### tRPC API Design

#### Router Structure
```typescript
// Main API router structure
export const appRouter = router({
    // Authentication routes
    auth: authRouter,
    
    // User management
    users: usersRouter,
    
    // Core recommendation system
    recommendations: recommendationsRouter,
    
    // Template management
    templates: templatesRouter,
    
    // Technology catalog
    technologies: technologiesRouter,
    
    // Analytics and metrics
    analytics: analyticsRouter,
    
    // Admin functionality
    admin: adminRouter,
});

export type AppRouter = typeof appRouter;
```

#### Recommendations Router
```typescript
export const recommendationsRouter = router({
    // Get personalized recommendations
    getPersonalizedRecommendations: publicProcedure
        .input(z.object({
            userId: z.string().uuid().optional(),
            context: z.object({
                projectType: z.string().optional(),
                experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
                teamSize: z.number().optional(),
                timeline: z.string().optional(),
            }).optional(),
            limit: z.number().default(10),
        }))
        .output(z.object({
            recommendations: z.array(recommendationSchema),
            explanations: z.array(explanationSchema),
            confidence: z.number().min(0).max(1),
            algorithm: z.string(),
            timestamp: z.date(),
        }))
        .query(async ({ input, ctx }) => {
            const { userId, context, limit } = input;
            
            // Get user preferences if authenticated
            const userPreferences = userId 
                ? await getUserPreferences(userId)
                : null;
            
            // Generate recommendations using ML service
            const recommendations = await ctx.recommendationEngine.generateRecommendations({
                userId,
                userPreferences,
                context,
                limit,
            });
            
            // Log interaction for ML training
            if (userId) {
                await logInteraction({
                    userId,
                    type: 'recommendation_request',
                    context: input,
                    timestamp: new Date(),
                });
            }
            
            return recommendations;
        }),

    // Submit recommendation feedback
    submitFeedback: protectedProcedure
        .input(z.object({
            recommendationId: z.string().uuid(),
            feedback: z.enum(['positive', 'negative', 'neutral']),
            comment: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { userId } = ctx.session;
            const { recommendationId, feedback, comment } = input;
            
            // Store feedback in database
            await ctx.db.recommendations.update({
                where: { id: recommendationId },
                data: {
                    feedback,
                    feedback_at: new Date(),
                },
            });
            
            // Update ML model with feedback
            await ctx.recommendationEngine.updateFromFeedback({
                recommendationId,
                userId,
                feedback,
                comment,
            });
            
            return { success: true };
        }),

    // Get recommendation explanations
    getExplanations: publicProcedure
        .input(z.object({
            recommendationIds: z.array(z.string().uuid()),
        }))
        .query(async ({ input, ctx }) => {
            const explanations = await Promise.all(
                input.recommendationIds.map(id => 
                    ctx.recommendationEngine.generateExplanation(id)
                )
            );
            
            return { explanations };
        }),
});
```

#### Input Validation Schemas
```typescript
// Comprehensive Zod schemas for type safety
export const recommendationSchema = z.object({
    id: z.string().uuid(),
    type: z.enum(['technology', 'template', 'stack']),
    item: z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),
        category: z.string(),
        tags: z.array(z.string()),
        metadata: z.record(z.any()),
    }),
    score: z.number().min(0).max(1),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
});

export const userPreferencesSchema = z.object({
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    preferredCategories: z.array(z.string()),
    avoidCategories: z.array(z.string()).optional(),
    learningCurvePreference: z.enum(['steep', 'moderate', 'gentle']),
    communitySupport: z.boolean().default(true),
    documentationQuality: z.number().min(1).max(5).default(3),
    performanceRequirements: z.enum(['low', 'medium', 'high']).default('medium'),
});
```

### Rate Limiting and Security
```typescript
// Rate limiting middleware
export const rateLimitMiddleware = (
    requestsPerMinute: number = 60
) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const key = `rate_limit:${req.ip}:${req.path}`;
        const current = await redis.incr(key);
        
        if (current === 1) {
            await redis.expire(key, 60); // 1 minute window
        }
        
        if (current > requestsPerMinute) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: await redis.ttl(key),
            });
        }
        
        next();
    };
};

// Security headers middleware
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
};
```

## Frontend Architecture

### Next.js Application Structure
```
src/
├── pages/                 # Next.js pages and API routes
│   ├── api/              # API endpoints (tRPC)
│   ├── dashboard/        # User dashboard pages
│   ├── recommendations/  # Recommendation interfaces
│   └── templates/        # Template management
├── components/           # Reusable UI components
│   ├── ai/              # AI-specific components
│   ├── common/          # Generic UI components
│   ├── dashboard/       # Dashboard components
│   └── forms/           # Form components
├── hooks/               # Custom React hooks
│   ├── useRecommendations.ts
│   ├── useRealTimeUpdates.ts
│   └── useAnalytics.ts
├── lib/                 # Utility libraries
│   ├── api/             # API client setup
│   ├── auth/            # Authentication helpers
│   ├── utils/           # Generic utilities
│   └── validation/      # Schema validation
├── store/               # State management
│   ├── recommendations/ # Recommendation state
│   ├── user/           # User preferences state
│   └── ui/             # UI state
└── styles/             # Styling and themes
    ├── globals.css     # Global styles
    └── components/     # Component-specific styles
```

### React Component Architecture
```typescript
// Recommendation system component
interface RecommendationSystemProps {
    userId?: string;
    context?: RecommendationContext;
    onRecommendationSelect?: (recommendation: Recommendation) => void;
}

export const RecommendationSystem: React.FC<RecommendationSystemProps> = ({
    userId,
    context,
    onRecommendationSelect,
}) => {
    // Custom hooks for data management
    const { 
        recommendations, 
        isLoading, 
        error,
        refreshRecommendations 
    } = useRecommendations({ userId, context });
    
    const { 
        subscribeToUpdates, 
        unsubscribeFromUpdates 
    } = useRealTimeUpdates();
    
    const { trackInteraction } = useAnalytics();
    
    // Subscribe to real-time updates
    useEffect(() => {
        if (userId) {
            const unsubscribe = subscribeToUpdates(userId, (updates) => {
                // Handle real-time recommendation updates
                refreshRecommendations();
            });
            
            return unsubscribe;
        }
    }, [userId, subscribeToUpdates, refreshRecommendations]);
    
    const handleRecommendationClick = useCallback((recommendation: Recommendation) => {
        // Track user interaction
        trackInteraction({
            type: 'recommendation_click',
            recommendationId: recommendation.id,
            userId,
        });
        
        // Call parent handler
        onRecommendationSelect?.(recommendation);
    }, [trackInteraction, onRecommendationSelect, userId]);
    
    if (isLoading) {
        return <RecommendationSkeleton />;
    }
    
    if (error) {
        return <ErrorBoundary error={error} onRetry={refreshRecommendations} />;
    }
    
    return (
        <div className="recommendation-system">
            <RecommendationHeader 
                count={recommendations.length}
                onRefresh={refreshRecommendations}
            />
            
            <RecommendationGrid 
                recommendations={recommendations}
                onRecommendationClick={handleRecommendationClick}
            />
            
            <RecommendationFeedback 
                recommendations={recommendations}
                userId={userId}
            />
        </div>
    );
};
```

### State Management with Zustand
```typescript
// Recommendation store
interface RecommendationStore {
    recommendations: Recommendation[];
    isLoading: boolean;
    error: string | null;
    context: RecommendationContext | null;
    
    // Actions
    setRecommendations: (recommendations: Recommendation[]) => void;
    addRecommendation: (recommendation: Recommendation) => void;
    removeRecommendation: (id: string) => void;
    updateContext: (context: RecommendationContext) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    
    // Async actions
    fetchRecommendations: (params: RecommendationParams) => Promise<void>;
    submitFeedback: (recommendationId: string, feedback: FeedbackType) => Promise<void>;
}

export const useRecommendationStore = create<RecommendationStore>((set, get) => ({
    recommendations: [],
    isLoading: false,
    error: null,
    context: null,
    
    setRecommendations: (recommendations) => set({ recommendations }),
    addRecommendation: (recommendation) => 
        set((state) => ({ 
            recommendations: [...state.recommendations, recommendation] 
        })),
    removeRecommendation: (id) =>
        set((state) => ({
            recommendations: state.recommendations.filter(r => r.id !== id)
        })),
    updateContext: (context) => set({ context }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    
    fetchRecommendations: async (params) => {
        set({ isLoading: true, error: null });
        try {
            const result = await trpc.recommendations.getPersonalizedRecommendations.query(params);
            set({ recommendations: result.recommendations, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },
    
    submitFeedback: async (recommendationId, feedback) => {
        try {
            await trpc.recommendations.submitFeedback.mutate({
                recommendationId,
                feedback,
            });
            
            // Update local state
            set((state) => ({
                recommendations: state.recommendations.map(r =>
                    r.id === recommendationId 
                        ? { ...r, userFeedback: feedback }
                        : r
                )
            }));
        } catch (error) {
            set({ error: error.message });
        }
    },
}));
```

## Infrastructure Architecture

### Production Docker Compose Architecture (Current)

**Updated:** 2025-10-27 - Production readiness infrastructure

The production environment uses Docker Compose with enterprise-grade security and monitoring:

```yaml
# Production Docker Compose Stack
services:
  # Next.js Application (Primary)
  app:
    image: build-my-stack:latest
    container_name: build-my-stack-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres@postgres:5432/buildmystack
      REDIS_URL: redis://redis:6379
    secrets:
      - db_password
      - redis_password
      - jwt_secret
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: build-my-stack-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - app
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL 18 Database
  postgres:
    image: postgres:18-alpine
    container_name: build-my-stack-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: buildmystack
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache Layer
  redis:
    image: redis:7-alpine
    container_name: build-my-stack-redis
    restart: unless-stopped
    command: redis-server --requirepass ""
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Prometheus Monitoring
  prometheus:
    image: prom/prometheus:latest
    container_name: build-my-stack-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:9090/-/healthy"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Grafana Dashboards
  grafana:
    image: grafana/grafana:latest
    container_name: build-my-stack-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_INSTALL_PLUGINS: ""
    volumes:
      - ./docker/grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
  redis_password:
    file: ./secrets/redis_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

#### Security Architecture

**Docker Secrets Management:**
- All sensitive credentials stored as Docker secrets
- No hardcoded passwords in configuration files
- Secrets read from `/run/secrets/` in containers
- `.gitignore` protection for secrets directory
- Automated secret generation with `openssl rand -base64 32`

**Nginx Security Headers:**
```nginx
# docker/nginx/conf.d/security-headers.conf
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

**Application Configuration:**
```typescript
// src/lib/config.ts
export function getSecret(secretName: string): string {
  const secretPath = `/run/secrets/${secretName}`;
  
  try {
    // Production: Read from Docker secrets
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
  } catch (error) {
    console.error(`Failed to read secret ${secretName}:`, error);
  }
  
  // Development: Fallback to environment variables
  const envValue = process.env[secretName.toUpperCase()];
  if (envValue) {
    return envValue;
  }
  
  throw new Error(`Secret ${secretName} not found`);
}
```

#### Monitoring and Observability

**Prometheus Metrics Collection:**
- Application metrics: `/api/metrics` endpoint
- PostgreSQL metrics: via postgres_exporter
- Redis metrics: via redis_exporter
- Nginx metrics: via nginx_exporter
- Custom business metrics: services viewed, stacks created, etc.

**Grafana Dashboards:**
1. **Application Dashboard**
   - Request rate and latency (p50, p95, p99)
   - Error rates by endpoint
   - Active user sessions
   - Business metrics (recommendations, stack creations)

2. **PostgreSQL Dashboard**
   - Connection pool utilization
   - Query performance (slow queries)
   - Database size and growth
   - Transaction throughput

3. **Redis Dashboard**
   - Cache hit/miss rates
   - Memory usage
   - Key eviction rates
   - Command statistics

4. **Nginx Dashboard**
   - Request rates by status code
   - Response times
   - Upstream health
   - SSL certificate expiration

**Health Check Endpoints:**
```typescript
// /api/health - Comprehensive health check
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-10-27T20:00:00Z",
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "details": {
        "connections": 18,
        "maxConnections": 100,
        "version": "PostgreSQL 18.0"
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "details": {
        "memory": "15MB",
        "connectedClients": 3
      }
    },
    "metrics": {
      "status": "healthy",
      "endpoint": "/api/metrics"
    }
  },
  "performance": {
    "avgResponseTime": 13,
    "requestsPerMinute": 150,
    "errorRate": 0.02
  },
  "alerts": []
}
```

### CI/CD Pipeline Architecture

**Platform:** GitLab CI/CD  
**Updated:** 2025-10-27 - Production readiness implementation

The project uses GitLab CI/CD for automated testing, security scanning, and deployment:

**Pipeline Stages:**
1. **Quality** - Linting, formatting, type-checking
2. **Test** - Unit tests, integration tests, E2E tests
3. **Build** - Application build and verification
4. **Security** - npm audit, Snyk scanning
5. **Performance** - Lighthouse CI performance testing
6. **Deploy-Staging** - Automated staging deployment (Vercel)
7. **Deploy-Production** - Manual production deployment (Vercel)
8. **Post-Deployment** - Health checks, notifications

**Quality Gates:**
- Test coverage threshold: 95%+
- Lint and type-check must pass
- Security vulnerabilities block deployment
- Bundle size limits enforced
- Secret scanning with Gitleaks

**GitLab CI Configuration:**
```yaml
# .gitlab-ci.yml
image: node:20

variables:
  DATABASE_URL_TEST: $DATABASE_URL_TEST

stages:
  - quality
  - test
  - build
  - security
  - performance
  - deploy-staging
  - deploy-production
  - post-deployment

quality:
  stage: quality
  script:
    - npm run lint
    - npm run format:check
    - npm run type-check

unit-tests:
  stage: test
  services:
    - postgres:18
  variables:
    DATABASE_URL: "postgresql://postgres:postgres@postgres:5432/buildmystack_test"
  script:
    - npm run db:generate
    - npm run db:deploy
    - npm run test
  coverage: '/All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/'

e2e-tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  services:
    - postgres:18
  script:
    - npm run db:generate
    - npm run db:deploy
    - npm run build
    - npm run test:e2e
  artifacts:
    when: always
    paths:
      - test-results/
      - playwright-report/

security:
  stage: security
  script:
    - npm audit --audit-level moderate --production
    # Snyk scan if token available
    - |
      if [ ! -z "$SNYK_TOKEN" ]; then
        npm install -g snyk
        snyk auth $SNYK_TOKEN
        snyk test --severity-threshold=medium
      fi
  allow_failure: true

performance:
  stage: performance
  before_script:
    - npm ci
    - npm install -g @lhci/cli@0.12.x
  script:
    - npm run build
    - lhci autorun
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_COMMIT_BRANCH == "develop"

deploy-staging:
  stage: deploy-staging
  environment:
    name: staging
    url: https://build-my-stack-staging.vercel.app
  before_script:
    - npm install -g vercel@latest
  script:
    - vercel --token $VERCEL_TOKEN --scope $VERCEL_ORG_ID
    - vercel build --token $VERCEL_TOKEN
    - vercel deploy --prebuilt --token $VERCEL_TOKEN
  rules:
    - if: $CI_COMMIT_BRANCH == "develop"
      when: manual

deploy-production:
  stage: deploy-production
  environment:
    name: production
    url: https://build-my-stack.vercel.app
  before_script:
    - npm install -g vercel@latest
  script:
    - vercel --token $VERCEL_TOKEN --scope $VERCEL_ORG_ID
    - vercel build --prod --token $VERCEL_TOKEN
    - vercel deploy --prebuilt --prod --token $VERCEL_TOKEN
    # Health check
    - sleep 60
    - curl --fail https://build-my-stack.vercel.app/api/health
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

**Required GitLab CI/CD Variables:**
- `VERCEL_TOKEN` - Vercel deployment token (masked, protected)
- `VERCEL_ORG_ID` - Vercel organization ID (protected)
- `SNYK_TOKEN` - Snyk security token (masked, optional)
- `SLACK_WEBHOOK_URL` - Slack notifications (masked, optional)

**Deployment Workflow:**
1. Developer creates feature branch
2. Push triggers quality + test stages
3. Merge to `develop` → staging deployment (manual)
4. Merge to `main` → production deployment (manual)
5. Post-deployment health checks and notifications

### Kubernetes Deployment Architecture (Future/Enterprise)
```yaml
# Production deployment structure
apiVersion: v1
kind: Namespace
metadata:
  name: buildmystack-prod
  labels:
    environment: production
---
# Application deployment with 3 replicas
apiVersion: apps/v1
kind: Deployment
metadata:
  name: buildmystack-app
  namespace: buildmystack-prod
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: buildmystack
      version: v1
  template:
    metadata:
      labels:
        app: buildmystack
        version: v1
    spec:
      containers:
      - name: app
        image: buildmystack:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: buildmystack-hpa
  namespace: buildmystack-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: buildmystack-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Load Balancing and Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: buildmystack-ingress
  namespace: buildmystack-prod
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - buildmystack.com
    - api.buildmystack.com
    secretName: buildmystack-tls
  rules:
  - host: buildmystack.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: buildmystack-service
            port:
              number: 80
  - host: api.buildmystack.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: buildmystack-api-service
            port:
              number: 80
```

## Security Architecture

### Authentication and Authorization Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant Auth Service
    participant Database
    
    User->>Frontend: Login Request
    Frontend->>Auth Service: Authenticate (OAuth/Credentials)
    Auth Service->>Database: Verify User
    Database-->>Auth Service: User Data
    Auth Service-->>Frontend: JWT Token + Refresh Token
    Frontend->>API Gateway: API Request + JWT
    API Gateway->>Auth Service: Validate Token
    Auth Service-->>API Gateway: Token Valid + User Context
    API Gateway->>Business Logic: Process Request
    Business Logic-->>API Gateway: Response
    API Gateway-->>Frontend: API Response
```

### Security Measures Implementation
```typescript
// JWT token validation middleware
export const validateJWT = async (token: string): Promise<UserContext | null> => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
        
        // Check token expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
            throw new Error('Token expired');
        }
        
        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, role: true, isActive: true },
        });
        
        if (!user || !user.isActive) {
            throw new Error('Invalid user');
        }
        
        return {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
    } catch (error) {
        console.error('JWT validation failed:', error);
        return null;
    }
};

// Input sanitization and validation
export const sanitizeInput = (input: any): any => {
    if (typeof input === 'string') {
        // Remove potential XSS vectors
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }
    
    if (Array.isArray(input)) {
        return input.map(sanitizeInput);
    }
    
    if (typeof input === 'object' && input !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    
    return input;
};

// Rate limiting implementation
export class RateLimiter {
    private redis: Redis;
    
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL!);
    }
    
    async checkRateLimit(
        identifier: string, 
        limit: number, 
        windowMs: number
    ): Promise<{ allowed: boolean; retryAfter?: number }> {
        const key = `rate_limit:${identifier}`;
        const multi = this.redis.multi();
        
        multi.incr(key);
        multi.expire(key, Math.ceil(windowMs / 1000));
        
        const results = await multi.exec();
        const current = results?.[0]?.[1] as number;
        
        if (current > limit) {
            const ttl = await this.redis.ttl(key);
            return {
                allowed: false,
                retryAfter: ttl > 0 ? ttl : Math.ceil(windowMs / 1000),
            };
        }
        
        return { allowed: true };
    }
}
```

## Performance Architecture

### Caching Strategy
```typescript
// Multi-layer caching implementation
export class CacheManager {
    private redis: Redis;
    private memoryCache: NodeCache;
    
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL!);
        this.memoryCache = new NodeCache({ 
            stdTTL: 300, // 5 minutes default TTL
            checkperiod: 60, // Check for expired keys every minute
        });
    }
    
    async get<T>(key: string): Promise<T | null> {
        // L1: Memory cache (fastest)
        const memoryResult = this.memoryCache.get<T>(key);
        if (memoryResult) {
            return memoryResult;
        }
        
        // L2: Redis cache (fast)
        const redisResult = await this.redis.get(key);
        if (redisResult) {
            const parsed = JSON.parse(redisResult);
            // Populate memory cache for next time
            this.memoryCache.set(key, parsed, 300); // 5 minutes
            return parsed;
        }
        
        return null;
    }
    
    async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
        // Set in both caches
        this.memoryCache.set(key, value, Math.min(ttl, 300)); // Max 5 min in memory
        await this.redis.setex(key, ttl, JSON.stringify(value));
    }
    
    async invalidate(pattern: string): Promise<void> {
        // Clear memory cache
        this.memoryCache.flushAll();
        
        // Clear matching Redis keys
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }
}

// Database query optimization
export class DatabaseOptimizer {
    private prisma: PrismaClient;
    
    constructor() {
        this.prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
    }
    
    // Optimized recommendation query with proper indexing
    async getRecommendationsOptimized(userId: string, limit: number = 10) {
        return await this.prisma.$queryRaw`
            SELECT DISTINCT
                t.id,
                t.name,
                t.description,
                t.category,
                t.popularity_score,
                COALESCE(ur.rating, 0) as user_rating,
                similarity_score.score
            FROM technologies t
            LEFT JOIN user_ratings ur ON ur.technology_id = t.id AND ur.user_id = ${userId}
            CROSS JOIN LATERAL (
                SELECT 
                    calculate_similarity(${userId}, t.id) as score
            ) similarity_score
            WHERE t.is_active = true
            ORDER BY similarity_score.score DESC, t.popularity_score DESC
            LIMIT ${limit}
        `;
    }
    
    // Connection pooling configuration
    async optimizeConnections() {
        // Configure connection pool
        await this.prisma.$executeRaw`SET max_connections = 200`;
        await this.prisma.$executeRaw`SET shared_preload_libraries = 'pg_stat_statements'`;
        
        // Enable query performance monitoring
        await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`;
    }
}
```

### Real-time Performance Monitoring
```typescript
// Performance monitoring service
export class PerformanceMonitor {
    private metrics: Map<string, number[]> = new Map();
    
    startTimer(operation: string): () => void {
        const startTime = process.hrtime.bigint();
        
        return () => {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            
            this.recordMetric(operation, duration);
        };
    }
    
    recordMetric(operation: string, value: number): void {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        
        const values = this.metrics.get(operation)!;
        values.push(value);
        
        // Keep only last 1000 measurements
        if (values.length > 1000) {
            values.shift();
        }
        
        // Log slow operations
        if (value > 1000) { // > 1 second
            console.warn(`Slow operation detected: ${operation} took ${value}ms`);
        }
    }
    
    getMetrics(operation: string) {
        const values = this.metrics.get(operation) || [];
        if (values.length === 0) return null;
        
        return {
            count: values.length,
            average: values.reduce((sum, val) => sum + val, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            p95: this.percentile(values, 0.95),
            p99: this.percentile(values, 0.99),
        };
    }
    
    private percentile(values: number[], p: number): number {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[index];
    }
}
```

## Monitoring and Observability

### Comprehensive Monitoring Setup
```typescript
// Application metrics collection
export class ApplicationMetrics {
    private prometheus = require('prom-client');
    
    // Define custom metrics
    private requestDuration = new this.prometheus.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.5, 1, 2, 5],
    });
    
    private recommendationAccuracy = new this.prometheus.Gauge({
        name: 'recommendation_accuracy_score',
        help: 'Current recommendation accuracy score',
        labelNames: ['algorithm_type'],
    });
    
    private activeUsers = new this.prometheus.Gauge({
        name: 'active_users_total',
        help: 'Number of active users',
        labelNames: ['time_window'], // '1h', '24h', '7d'
    });
    
    private databaseConnections = new this.prometheus.Gauge({
        name: 'database_connections_active',
        help: 'Number of active database connections',
    });
    
    // Middleware to collect HTTP metrics
    collectHttpMetrics() {
        return (req: Request, res: Response, next: NextFunction) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = (Date.now() - start) / 1000;
                this.requestDuration
                    .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
                    .observe(duration);
            });
            
            next();
        };
    }
    
    // Update recommendation metrics
    updateRecommendationMetrics(algorithm: string, accuracy: number) {
        this.recommendationAccuracy
            .labels(algorithm)
            .set(accuracy);
    }
    
    // Update user metrics
    async updateUserMetrics() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const [hourly, daily, weekly] = await Promise.all([
            prisma.user.count({ where: { lastActiveAt: { gte: oneHourAgo } } }),
            prisma.user.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
            prisma.user.count({ where: { lastActiveAt: { gte: oneWeekAgo } } }),
        ]);
        
        this.activeUsers.labels('1h').set(hourly);
        this.activeUsers.labels('24h').set(daily);
        this.activeUsers.labels('7d').set(weekly);
    }
    
    // Get metrics endpoint
    getMetrics() {
        return this.prometheus.register.metrics();
    }
}
```

### Health Check Implementation
```typescript
export class HealthChecker {
    private checks: Map<string, HealthCheck> = new Map();
    
    constructor() {
        this.registerDefaultChecks();
    }
    
    registerCheck(name: string, check: HealthCheck) {
        this.checks.set(name, check);
    }
    
    async runHealthChecks(): Promise<HealthStatus> {
        const results = new Map<string, CheckResult>();
        const promises = Array.from(this.checks.entries()).map(async ([name, check]) => {
            try {
                const startTime = Date.now();
                const result = await Promise.race([
                    check.execute(),
                    new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Check timeout')), check.timeout || 5000)
                    ),
                ]);
                
                results.set(name, {
                    status: result ? 'healthy' : 'unhealthy',
                    duration: Date.now() - startTime,
                    details: result,
                });
            } catch (error) {
                results.set(name, {
                    status: 'unhealthy',
                    duration: Date.now() - Date.now(),
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        
        await Promise.all(promises);
        
        const overallStatus = Array.from(results.values()).every(r => r.status === 'healthy')
            ? 'healthy'
            : 'unhealthy';
        
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks: Object.fromEntries(results),
        };
    }
    
    private registerDefaultChecks() {
        // Database connectivity check
        this.registerCheck('database', {
            execute: async () => {
                await prisma.$queryRaw`SELECT 1`;
                return true;
            },
            timeout: 5000,
        });
        
        // Redis connectivity check
        this.registerCheck('redis', {
            execute: async () => {
                const redis = new Redis(process.env.REDIS_URL!);
                const result = await redis.ping();
                await redis.quit();
                return result === 'PONG';
            },
            timeout: 3000,
        });
        
        // ML service check
        this.registerCheck('ml_service', {
            execute: async () => {
                const response = await fetch(`${process.env.ML_SERVICE_URL}/health`);
                return response.ok;
            },
            timeout: 5000,
        });
        
        // Memory usage check
        this.registerCheck('memory', {
            execute: async () => {
                const usage = process.memoryUsage();
                const totalMemory = usage.heapTotal + usage.external;
                const maxMemory = 512 * 1024 * 1024; // 512MB limit
                return totalMemory < maxMemory;
            },
            timeout: 1000,
        });
    }
}

interface HealthCheck {
    execute: () => Promise<any>;
    timeout?: number;
}

interface CheckResult {
    status: 'healthy' | 'unhealthy';
    duration: number;
    details?: any;
    error?: string;
}

interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    checks: Record<string, CheckResult>;
}
```

This technical architecture documentation provides a comprehensive overview of the BuildMyStack AI-Powered Recommendations system. The architecture is designed for scalability, security, and maintainability, with comprehensive monitoring and observability features built-in.

The system leverages modern technologies and best practices to deliver high-performance, intelligent recommendations while maintaining enterprise-grade security and reliability standards.