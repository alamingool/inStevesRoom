# main Python file
# main App logic

import os
import json
import shutil
import time
import google.genai as genai
from google.genai import types
from datetime import datetime
from dotenv import load_dotenv

# --- 1. Import The New Logic ---
# We keep the logic separate to keep this file clean.
from steve import STEVE_PERSONA, NARRATIVE_LOGIC, UNIFIED_PROMPT_TEMPLATE

# --- 2. Create Logs Directory ---
os.makedirs('logs', exist_ok=True)

# --- 3. Configure Gemini API Client ---
load_dotenv() # This line loads variables from a .env file for local testing

try:
    # --- THIS IS THE IMPORTANT CHANGE ---
    api_key = os.getenv("GOOGLE_GEMINI_KEY")
    if not api_key:
        raise ValueError("GOOGLE_GEMINI_KEY not found in environment variables.")
        
    client = genai.Client(api_key=api_key)
    print("Gemini API Client created successfully.")
except Exception as e:
    print(f"Error creating Gemini client: {e}")
    print("Please ensure the GOOGLE_GEMINI_KEY environment variable is set.")
    exit()


# Setup safety settings
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

# --- 4. State Management and Logging (Largely Unchanged) ---
def load_state(filename="state.json"):
    try:
        with open(filename, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def save_state(state_data, filename="state.json"):
    with open(filename, 'w') as f:
        json.dump(state_data, f, indent=4)

def reset_state(state_file="state.json", template_file="template.json"):
    try:
        shutil.copyfile(template_file, state_file)
        print("\n[System: state.json has been reset to default.]")
        return load_state(state_file)
    except FileNotFoundError:
        print(f"\n[System Error: Could not find template file '{template_file}' to reset state.]")
        return None

def get_unique_log_filename(name):
    sanitized_name = "".join(c for c in name if c.isalnum() or c in (' ', '_')).rstrip().replace(' ', '_')
    base_path = os.path.join('logs', f"{sanitized_name}.log")
    if not os.path.exists(base_path):
        return base_path
    counter = 1
    while True:
        new_path = os.path.join('logs', f"{sanitized_name}_{counter}.log")
        if not os.path.exists(new_path):
            return new_path
        counter += 1

def log_conversation(filename, user_name, user_input, ai_response):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_entry = (
        f"[{timestamp}] {user_name}: {user_input}\n"
        f"[{timestamp}] Steve: {ai_response}\n"
        "---\n"
    )
    with open(filename, 'a', encoding='utf-8') as f:
        f.write(log_entry)

# --- 5. Core AI Logic Function (The Final, Resilient Model) ---
def run_steve_ai(current_state, user_input, max_retries=3):
    """
    Runs the single-call AI with manual JSON parsing and an automatic retry loop.
    """
    print("\n[Steve is thinking...]")

    prompt = UNIFIED_PROMPT_TEMPLATE.format(
        steve_persona=STEVE_PERSONA,
        narrative_logic=NARRATIVE_LOGIC,
        current_state_json=json.dumps(current_state, indent=2),
        user_input=user_input
    )

    # --- AUTOMATIC RETRY LOOP ---
    for attempt in range(max_retries):
        try:
            config = types.GenerateContentConfig(response_mime_type='application/json', safety_settings=safety_settings)
            response = client.models.generate_content(model='models/gemini-2.5-flash-lite', contents=prompt, config=config)
            
            raw_json_text = response.text
            
            try:
                response_data = json.loads(raw_json_text)
                print("[Steve has figured out what to say.]")

                new_state = response_data.get('newState')
                ai_dialogue = response_data.get('dialogue', "I... I'm lost for words.")

                if not new_state:
                    print("[AI Error] The AI returned JSON but was missing the 'newState' object.")
                    return response_data, current_state, "I... lost my train of thought. What were we talking about?"

                # SUCCESS: Return the FULL response data AND the new state object.
                return response_data, new_state

            except json.JSONDecodeError:
                print("[AI Error] CRITICAL: The AI response was not valid JSON.")
                print(f"--- Raw AI Response ---\n{raw_json_text}\n-----------------------")
                return current_state, "Sorry, I got a little tongue-tied there. Could you say that again?"

        except types.InternalServerError as e:
            # This specifically catches the '503 UNAVAILABLE' error.
            print(f"[AI Warning] Model is overloaded (Attempt {attempt + 1}/{max_retries}). Retrying in 3 seconds...")
            time.sleep(3) # Wait before the next attempt.
        
        except Exception as e:
            # This catches other, non-retriable errors (e.g., bad API key, network issues).
            print(f"[AI Error] A critical, non-retriable error occurred: {e}")
            return current_state, "Sorry, my mind just blanked for a second. What were we saying?"

    # --- THIS CODE ONLY RUNS IF ALL RETRIES FAIL ---
    print("[AI Error] All retries failed. The model seems to be consistently unavailable.")
    return current_state, "Ugh, sorry, I can't even think straight right now. There's too much static in my head."

# --- 6. Main Application Loop ---
def main_cli_loop():
    print("\n--- In Steve's Room ---")
    user_name = input("Please enter your name for this session: ")
    log_filename = get_unique_log_filename(user_name)
    print(f"[System: This conversation will be logged to '{log_filename}']")
    print("\nType 'quit' to exit. Type 'reset' to start over.")

    # --- AUTOMATIC RESET ON LAUNCH ---
    print("\n[System: Initializing a new conversation with Steve.]")
    current_state = reset_state()
    if current_state is None:
        # This will only happen if state_template.json is missing.
        print("[System Error] Could not start the application. State template is missing.")
        return 

    # The pre-scripted opening to set the scene
    print("\n(You're sitting in silence with your friend, Steve. He's been quiet for a while, just lying on his bed and staring at the ceiling. He lets out a heavy sigh.)")
    print("\nSteve: ... (sigh)")
    print(f"{user_name}: What's wrong?")
    print("Steve: Ah... nothing. I'm just... stuck on something.")
    print(f"{user_name}: Well then... what is it?")
    print("Steve: A project, for school. It's just... nothing...")
    print(f"{user_name}: Come on, you can tell me.")
    print("Steve: Well... (he sits up) ...you know I have this assignment coming up, asking me to make some kind of art piece about myself, but... I don't know, what am I even like?")

    while True:
        user_input = input(f"{user_name}: ")

        if user_input.lower() == 'quit':
            print("\nSteve just nods quietly, lost in his own thoughts.")
            break

        if user_input.lower() == 'reset':
            current_state = reset_state()
            print("\n(You reset the conversation back to the beginning.)")
            print("Steve: ...you know I have this assignment coming up... but... I don't know, what am I even like?")
            continue

        # This is our new, streamlined call. One function, half the API requests!
        new_state, ai_dialogue = run_steve_ai(current_state, user_input)

        print(f"\nSteve: {ai_dialogue}")

        log_conversation(log_filename, user_name, user_input, ai_dialogue)

        save_state(new_state)
        current_state = new_state