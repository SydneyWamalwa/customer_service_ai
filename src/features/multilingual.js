/**
 * Multilingual support for the multi-tenant customer support agent
 * Handles language detection and translation
 */

// Language codes and names mapping
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ja': 'Japanese',
  'zh': 'Chinese',
  'ko': 'Korean',
  'ar': 'Arabic'
};

/**
 * Detects the language of a text using AI model
 * @param {string} text - The text to detect language for
 * @param {object} env - Environment with AI binding
 * @returns {Promise<string>} - The detected language code
 */
async function detectLanguage(text, env) {
  try {
    // Use AI model to detect language
    const prompt = `
    Detect the language of the following text and respond with only the language code.
    Use one of these codes: en, es, fr, de, it, pt, ja, zh, ko, ar.
    
    Text: "${text}"
    
    Language code:
    `;
    
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt
    });
    
    // Extract language code from response
    const languageCode = response.trim().toLowerCase();
    
    // Validate the language code
    if (SUPPORTED_LANGUAGES[languageCode]) {
      return languageCode;
    }
    
    // Default to English if detection fails
    return 'en';
  } catch (error) {
    console.error('Language detection error:', error);
    return 'en'; // Default to English on error
  }
}

/**
 * Translates text to the target language using AI model
 * @param {string} text - The text to translate
 * @param {string} targetLanguage - The target language code
 * @param {object} env - Environment with AI binding
 * @returns {Promise<string>} - The translated text
 */
async function translateText(text, targetLanguage, env) {
  try {
    // Skip translation if already in target language
    const sourceLanguage = await detectLanguage(text, env);
    if (sourceLanguage === targetLanguage) {
      return text;
    }
    
    // Use AI model to translate text
    const prompt = `
    Translate the following text from ${SUPPORTED_LANGUAGES[sourceLanguage]} to ${SUPPORTED_LANGUAGES[targetLanguage]}.
    Respond with only the translated text, no explanations.
    
    Text: "${text}"
    
    Translation:
    `;
    
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt
    });
    
    return response.trim();
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text on error
  }
}

/**
 * Manages user language preferences
 */
class LanguageManager {
  /**
   * Creates a new LanguageManager instance
   * @param {object} env - Environment with AI binding
   */
  constructor(env) {
    this.env = env;
    this.userLanguages = new Map(); // Map of userId to language preference
  }
  
  /**
   * Sets the language preference for a user
   * @param {string} userId - The user ID
   * @param {string} languageCode - The language code
   */
  setUserLanguage(userId, languageCode) {
    if (SUPPORTED_LANGUAGES[languageCode]) {
      this.userLanguages.set(userId, languageCode);
    }
  }
  
  /**
   * Gets the language preference for a user
   * @param {string} userId - The user ID
   * @returns {string} - The language code
   */
  getUserLanguage(userId) {
    return this.userLanguages.get(userId) || 'en';
  }
  
  /**
   * Processes a user message for multilingual support
   * @param {string} message - The user message
   * @param {string} userId - The user ID
   * @returns {Promise<object>} - Object with detected language and processed message
   */
  async processUserMessage(message, userId) {
    // Detect language if not already set
    if (!this.userLanguages.has(userId)) {
      const detectedLanguage = await detectLanguage(message, this.env);
      this.setUserLanguage(userId, detectedLanguage);
    }
    
    // Return the detected language and original message
    return {
      message,
      detectedLanguage: this.getUserLanguage(userId)
    };
  }
  
  /**
   * Processes an agent response for multilingual support
   * @param {string} response - The agent response
   * @param {string} userId - The user ID
   * @returns {Promise<string>} - The translated response
   */
  async processAgentResponse(response, userId) {
    const userLanguage = this.getUserLanguage(userId);
    
    // Translate response to user's language if not English
    if (userLanguage !== 'en') {
      return await translateText(response, userLanguage, this.env);
    }
    
    return response;
  }
  
  /**
   * Gets all supported languages
   * @returns {object} - Object mapping language codes to names
   */
  getSupportedLanguages() {
    return { ...SUPPORTED_LANGUAGES };
  }
}

module.exports = {
  LanguageManager,
  detectLanguage,
  translateText,
  SUPPORTED_LANGUAGES
};