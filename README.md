# Giveaway Bot

This is a Discord bot for managing giveaways with advanced features.

## Features

- Create and end giveaways.
- Role-based exclusion from giveaways.
- Weighted entries for participants.
- Manually pick a winner with a specific probability.
- Configure settings using commands.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure the bot:**
   - Open the `config.json` file.
   - Replace `"YOUR_BOT_TOKEN"` with your Discord bot token.

3. **Run the bot:**
   ```bash
   node index.js
   ```

## Commands

### Giveaway Commands

- `g-create <prize>`: Creates a new giveaway.
- `g-end <giveaway_message_id>`: Ends a giveaway and selects a winner.
- `g-weight <giveaway_message_id> <user_id> <weight>`: Sets a weight for a user in a giveaway.
- `g-pick <giveaway_message_id> <user_id> <probability>`: Sets a specific user to have a certain probability of winning.

### Configuration Commands

- `g-config excluded-role <role_id>`: Sets the role to be excluded from giveaways. To clear, run the command without a role ID.
- `g-config show`: Shows the current configuration.