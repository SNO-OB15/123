const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, InteractionType,
    ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require('discord.js');
const { token } = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const giveaways = new Map();
let excludedRoleId = null;

client.once('ready', () => {
    console.log('Ready!');
});

// ------------------------------
// 확률 계산 함수
// ------------------------------
async function calculateParticipants(interaction, giveaway) {
    const giveawayMessage = await interaction.channel.messages.fetch(giveaway.messageId);
    const reaction = giveawayMessage.reactions.cache.get('🎉');
    const users = await reaction.users.fetch();

    let participants = [];
    for (const user of users.values()) {
        if (user.bot) continue;
        if (excludedRoleId) {
            const member = await interaction.guild.members.fetch(user.id);
            if (member.roles.cache.has(excludedRoleId)) continue;
        }
        const weight = giveaway.weights.get(user.id) || 1;
        participants.push({ id: user.id, weight });
    }

    if (participants.length === 0) return [];

    let pickedUserProb = 0;
    if (giveaway.pickedUser) pickedUserProb = giveaway.pickedUser.probability;

    const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0);
    participants = participants.map(p => {
        if (giveaway.pickedUser && p.id === giveaway.pickedUser.id) {
            return { ...p, prob: pickedUserProb.toFixed(2) };
        } else {
            const prob = ((100 - pickedUserProb) * p.weight / totalWeight);
            return { ...p, prob: prob.toFixed(2) };
        }
    });

    return participants;
}

// ------------------------------
// 페이지 렌더링 함수
// ------------------------------
function renderPage(participants, page, pageSize = 10) {
    const start = page * pageSize;
    const slice = participants.slice(start, start + pageSize);
    const desc = slice.map(u => `<@${u.id}>: ${u.prob}%`).join('\n');
    return new EmbedBuilder()
        .setTitle('📊 이벤트 응모 확률')
        .setDescription(desc || '참가자가 없습니다.')
        .setFooter({ text: `총 ${participants.length}명 | Page ${page+1}/${Math.ceil(participants.length/pageSize)}` });
}

function getNavRow(messageId, page, totalPages) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`prev_${messageId}_${page}`)
            .setLabel('◀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`next_${messageId}_${page}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
    );
}

// ------------------------------
// 인터랙션 처리
// ------------------------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    const { commandName, options } = interaction;

    // --------------------------
    // /giveaway
    // --------------------------
    if (interaction.isChatInputCommand() && commandName === 'giveaway') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'create') {
            const prize = options.getString('prize');
            const embed = new EmbedBuilder()
                .setTitle('🎉 이벤트! 🎉')
                .setDescription(`🎉 반응을 눌러 응모하세요!\nPrize: **${prize}**`)
                .setColor('Random')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`show_prob_${Date.now()}`)
                    .setLabel('📊 확률 보기')
                    .setStyle(ButtonStyle.Primary)
            );

            const giveawayMessage = await interaction.channel.send({ embeds: [embed], components: [row] });
            giveawayMessage.react('🎉');

            giveaways.set(giveawayMessage.id, {
                prize,
                participants: new Map(),
                messageId: giveawayMessage.id,
                channelId: interaction.channel.id,
                ended: false,
                weights: new Map(),
                pickedUser: null
            });

            await interaction.reply({ content: '이벤트가 개설되었습니다.', ephemeral: true });
        }

        else if (subcommand === 'end') {
            const messageId = options.getString('message_id');
            const giveaway = giveaways.get(messageId);

            if (!giveaway || giveaway.ended) {
                return interaction.reply({ content: '이 이벤트는 종료되었거나 존재하지 않습니다.', ephemeral: true });
            }

            const participants = await calculateParticipants(interaction, giveaway);
            if (participants.length === 0) {
                return interaction.reply({ content: '응모자가 없습니다.', ephemeral: true });
            }

            let winner;
            if (giveaway.pickedUser && Math.random() * 100 < giveaway.pickedUser.probability) {
                winner = await client.users.fetch(giveaway.pickedUser.id);
            } else {
                const weighted = [];
                for (const p of participants) {
                    for (let i = 0; i < p.weight; i++) weighted.push(p.id);
                }
                const winnerId = weighted[Math.floor(Math.random() * weighted.length)];
                winner = await client.users.fetch(winnerId);
            }

            giveaway.ended = true;

            const winnerEmbed = new EmbedBuilder()
                .setTitle('🎉 이벤트 종료 🎉')
                .setDescription(`당첨자: ${winner}\nPrize: **${giveaway.prize}**`)
                .setColor('Random')
                .setTimestamp();

            await interaction.channel.send({ embeds: [winnerEmbed] });
            const giveawayMessage = await interaction.channel.messages.fetch(giveaway.messageId);
            giveawayMessage.edit({ components: [] });

            await interaction.reply({ content: '이벤트를 종료했습니다.', ephemeral: true });
        }

        else if (subcommand === 'weight') {
            const messageId = options.getString('message_id');
            const user = options.getUser('user');
            const weight = options.getInteger('weight');
            const giveaway = giveaways.get(messageId);

            if (!giveaway) return interaction.reply({ content: '이벤트를 찾을 수 없습니다.', ephemeral: true });
            if (weight <= 0) return interaction.reply({ content: '가중치는 0보다 커야 합니다.', ephemeral: true });

            giveaway.weights.set(user.id, weight);
            await interaction.reply({ content: `${user} 에게 ${weight} 가중치를 설정했습니다.`, ephemeral: true });
        }

        else if (subcommand === 'pick') {
            const messageId = options.getString('message_id');
            const user = options.getUser('user');
            const probability = options.getInteger('probability');
            const giveaway = giveaways.get(messageId);

            if (!giveaway) return interaction.reply({ content: '이벤트를 찾을 수 없습니다.', ephemeral: true });
            if (probability < 0 || probability > 100) {
                return interaction.reply({ content: '0과 100 사이 값이어야 합니다.', ephemeral: true });
            }

            giveaway.pickedUser = { id: user.id, probability };
            await interaction.reply({ content: `${user} 의 당첨 확률을 ${probability}%로 설정했습니다.`, ephemeral: true });
        }
    }

    // --------------------------
    // /config
    // --------------------------
    if (interaction.isChatInputCommand() && commandName === 'config') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'excluded-role') {
            const role = options.getRole('role');
            excludedRoleId = role.id;
            await interaction.reply({ content: `제외 역할 ID가 ${excludedRoleId} 로 설정되었습니다.`, ephemeral: true });
        } else if (subcommand === 'show') {
            await interaction.reply({ content: `현재 설정\nExcluded Role ID: ${excludedRoleId || '없음'}`, ephemeral: true });
        }
    }

    // --------------------------
    // 📊 확률 보기 버튼
    // --------------------------
    if (interaction.isButton()) {
        // 확률 보기 눌렀을 때
        if (interaction.customId.startsWith('show_prob_')) {
            const giveaway = [...giveaways.values()].find(g => g.messageId === interaction.message.id);
            if (!giveaway) return;

            const participants = await calculateParticipants(interaction, giveaway);
            if (participants.length === 0) {
                return interaction.reply({ content: '응모자가 없습니다.', ephemeral: true });
            }

            let page = 0;
            const totalPages = Math.ceil(participants.length / 10);
            await interaction.reply({
                embeds: [renderPage(participants, page)],
                components: [getNavRow(giveaway.messageId, page, totalPages)],
                ephemeral: true
            });
        }

        // ◀ / ▶ 버튼 눌렀을 때
        else if (interaction.customId.startsWith('prev_') || interaction.customId.startsWith('next_')) {
            const [action, messageId, currentPage] = interaction.customId.split('_');
            const giveaway = giveaways.get(messageId);
            if (!giveaway) return;

            const participants = await calculateParticipants(interaction, giveaway);
            const totalPages = Math.ceil(participants.length / 10);
            let page = parseInt(currentPage, 10);

            if (action === 'prev') page = Math.max(0, page - 1);
            else page = Math.min(totalPages - 1, page + 1);

            await interaction.update({
                embeds: [renderPage(participants, page)],
                components: [getNavRow(messageId, page, totalPages)]
            });
        }
    }
});

client.login(token);
