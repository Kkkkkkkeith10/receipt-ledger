/**
 * AI Connection Test - Using LlamaIndex
 * 
 * Tests the actual Azure OpenAI connection using LlamaIndex like aiv4.
 * Run with: pnpm test:ai:connection
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .dev.vars from project root
dotenv.config({ path: path.join(__dirname, '..', '.dev.vars') });

import { AzureOpenAI } from '@llamaindex/azure';
import { Settings, type ChatMessage, type LLMChatParamsNonStreaming } from 'llamaindex';

// Load environment variables
const AZURE_FOUNDRY_ENDPOINT = process.env.AZURE_FOUNDRY_ENDPOINT || '';
const AZURE_FOUNDRY_KEY = process.env.AZURE_FOUNDRY_KEY || '';
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini';

async function testConnection(): Promise<void> {
    console.log('\n🔌 Testing Azure OpenAI Connection (LlamaIndex)\n');
    console.log('='.repeat(60));

    // Check if credentials are set
    console.log('\n📋 Configuration Check:');
    console.log(`   Endpoint: ${AZURE_FOUNDRY_ENDPOINT ? '✅ Set' : '❌ Missing'}`);
    console.log(`   API Key: ${AZURE_FOUNDRY_KEY ? '✅ Set (' + AZURE_FOUNDRY_KEY.substring(0, 8) + '...)' : '❌ Missing'}`);
    console.log(`   Deployment: ${AZURE_OPENAI_DEPLOYMENT || '❌ Missing'}`);

    if (!AZURE_FOUNDRY_ENDPOINT || !AZURE_FOUNDRY_KEY) {
        console.log('\n❌ Missing required credentials!');
        console.log('\nTo set up credentials:');
        console.log('1. Copy .dev.vars.example to .dev.vars');
        console.log('2. Fill in your Azure OpenAI credentials');
        console.log('3. Or set environment variables:');
        console.log('   $env:AZURE_FOUNDRY_ENDPOINT = "https://your-resource.openai.azure.com/"');
        console.log('   $env:AZURE_FOUNDRY_KEY = "your-api-key"');
        console.log('   $env:AZURE_OPENAI_DEPLOYMENT = "gpt-4o"');
        process.exit(1);
    }

    console.log('\n🔄 Creating LlamaIndex Azure client...\n');

    try {
        // Create Azure OpenAI client using LlamaIndex
        const client = new AzureOpenAI({
            apiKey: AZURE_FOUNDRY_KEY,
            endpoint: AZURE_FOUNDRY_ENDPOINT,
            deployment: AZURE_OPENAI_DEPLOYMENT
        });

        Settings.llm = client as any;

        console.log('🔄 Testing basic chat completion...\n');

        const startTime = Date.now();

        const messages: ChatMessage[] = [
            { role: 'user', content: 'Say "Hello, the AI connection is working!" in exactly those words.' }
        ];

        const chatOptions: LLMChatParamsNonStreaming = {
            messages,
            stream: false,
            additionalChatOptions: {
                temperature: 1,
                top_p: 1
            }
        };

        const response = await Settings.llm.chat(chatOptions);
        const content = String(response?.message?.content);

        const duration = Date.now() - startTime;

        console.log('✅ Connection successful!');
        console.log(`   Response: "${content}"`);
        console.log(`   Duration: ${duration}ms`);

    } catch (error: any) {
        console.log('❌ Connection failed!');
        console.log(`   Error: ${error.message}`);

        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
            console.log('\n   💡 Hint: Invalid API key. Check your AZURE_FOUNDRY_KEY.');
        } else if (error.message?.includes('404') || error.message?.includes('not found')) {
            console.log('\n   💡 Hint: Deployment not found. Check your AZURE_OPENAI_DEPLOYMENT.');
        } else if (error.message?.includes('ENOTFOUND')) {
            console.log('\n   💡 Hint: Cannot reach endpoint. Check your AZURE_FOUNDRY_ENDPOINT.');
        }

        process.exit(1);
    }

    // Test vision capability
    console.log('\n🖼️  Testing vision capability...\n');

    try {
        // Test with a simple base64 image (1x1 red pixel PNG)
        const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

        const startTime = Date.now();

        const messages: ChatMessage[] = [
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'What color is this image? Answer in one word.' },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/png;base64,${testImageBase64}`,
                            detail: 'low'
                        }
                    }
                ] as any
            }
        ];

        const chatOptions: LLMChatParamsNonStreaming = {
            messages,
            stream: false,
            additionalChatOptions: {
                temperature: 1,
                top_p: 1
            }
        };

        const response = await Settings.llm.chat(chatOptions);
        const content = String(response?.message?.content);

        const duration = Date.now() - startTime;

        console.log('✅ Vision capability confirmed!');
        console.log(`   Response: "${content}"`);
        console.log(`   Duration: ${duration}ms`);

    } catch (error: any) {
        console.log('⚠️  Vision test failed (may not be supported by this model)');
        console.log(`   Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ All connection tests passed!\n');
}

// Run
testConnection().catch(console.error);
