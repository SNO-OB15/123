const {
  Client, GatewayIntentBits, Partials,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const fs = require('fs');
const { token } = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let giveaways = new Map();
let excludedRoleIds = [];  // ✅ 여러 개
let allowedRoleIds = [];   // ✅ 허용된 역할

// ---------------- 저장/로드 ----------------
function saveData() {
  const data = {
    giveaways: Array.from(giveaways.entries()),
    excludedRoleIds,
    allowedRoleIds,
  };
  fs.writeFileSync('./data.json.tmp', JSON.stringify(data, null, 2));
  fs.renameSync('./data.json.tmp', './data.json');
}
function loadData() {
  if (fs.existsSync('./data.json')) {
    const raw = fs.readFileSync('./data.json');
    const data = JSON.parse(raw);
    giveaways = new Map(data.giveaways);
    excludedRoleIds = data.excludedRoleIds || [];
    allowedRoleIds = data.allowedRoleIds || [];
  }
}

// ---------------- 권한 체크 ----------------
function hasPermission(interaction) {
  return (
    interaction.memberPermissions.has('Administrator') ||
    allowedRoleIds.some(roleId => interaction.member.roles.cache.has(roleId))
  );
}

// ---------------- 확률 계산 ----------------
async function calculateParticipants(interaction, giveaway) {
  const giveawayMessage = await interaction.channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!giveawayMessage) return [];

  const reaction = giveawayMessage.reactions?.cache.get('🎉');
  if (!reaction) return [];

  const users = await reaction.users.fetch().catch(() => null);
  if (!users) return [];

  let participants = [];
  for (const user of users.values()) {
    if (user.bot) continue;

    // 제외 역할 필터링
    if (excludedRoleIds.length > 0) {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) continue;
      if (excludedRoleIds.some(rid => member.roles.cache.has(rid))) continue;
    }

    const weight = giveaway.weights.get(user.id) || 1;
    participants.push({ id: user.id, weight });
  }

  if (participants.length === 0) return [];

  const pickedUserId = giveaway.pickedUser?.id || null;
  const pickedUserProb = giveaway.pickedUser?.probability ?? 0;

  const totalWeight = participants.reduce((s, p) => s + p.weight, 0);
  const pickedWeight = pickedUserId
    ? (participants.find(p => p.id === pickedUserId)?.weight ?? (giveaway.weights.get(pickedUserId) || 1))
    : 0;
  const othersTotal = Math.max(0, totalWeight - pickedWeight);

  return participants.map(p => {
    if (pickedUserId && p.id === pickedUserId) {
      return { ...p, prob: pickedUserProb.toFixed(2) };
    }
    const remain = Math.max(0, 100 - pickedUserProb);
    const prob = othersTotal > 0 ? (remain * p.weight / othersTotal) : 0;
    return { ...p, prob: prob.toFixed(2) };
  });
}

client.once('ready', () => {
  console.log(`${client.user.tag} is online!`);
  loadData();
});

// ---------------- 이벤트 ----------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // 🎉 giveaway
  if (interaction.commandName === 'giveaway') {
    if (!hasPermission(interaction)) {
      return interaction.reply({ content: '이 명령은 관리자 또는 허용된 역할만 사용할 수 있습니다.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    // --- create ---
    if (subcommand === 'create') {
      const name = interaction.options.getString('name');
      const prize = interaction.options.getString('prize');

      const title = name ? `🎉 **${name}** 🎉` : '🎉 이벤트 🎉';
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`🎉 반응을 눌러 응모하세요!\n상품: **${prize}**`)
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setTimestamp();

      const giveawayMessage = await interaction.channel.send({ embeds: [embed] }).catch(() => null);
      if (!giveawayMessage) return interaction.reply({ content: '메시지 전송 실패', ephemeral: true });

      await giveawayMessage.react('🎉').catch(() => null);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`show_prob_${giveawayMessage.id}`)
          .setLabel('📊 확률 보기')
          .setStyle(ButtonStyle.Primary)
      );
      await giveawayMessage.edit({ components: [row] });

      giveaways.set(giveawayMessage.id, {
        prize,
        participants: new Map(),
        messageId: giveawayMessage.id,
        channelId: interaction.channel.id,
        ended: false,
        weights: new Map(),
        pickedUser: null
      });

      saveData();
      return interaction.reply({ content: '이벤트가 개설되었습니다.', ephemeral: true });
    }

    // --- end ---
    else if (subcommand === 'end') {
      const messageId = interaction.options.getString('message_id');
      const giveaway = giveaways.get(messageId);
      if (!giveaway || giveaway.ended)
        return interaction.reply({ content: '이미 종료된 이벤트이거나 존재하지 않음.', ephemeral: true });

      const participants = await calculateParticipants(interaction, giveaway);
      if (participants.length === 0)
        return interaction.reply({ content: '응모자가 없습니다.', ephemeral: true });

      let winnerId = null;
      const pickedUserId = giveaway.pickedUser?.id || null;
      const pickedUserProb = giveaway.pickedUser?.probability ?? 0;

      if (pickedUserId && Math.random() * 100 < pickedUserProb) {
        winnerId = pickedUserId;
      } else {
        const pool = participants.filter(p => p.id !== pickedUserId);
        const weighted = [];
        for (const p of pool) for (let i = 0; i < Math.max(1, p.weight); i++) weighted.push(p.id);
        if (weighted.length === 0 && pickedUserId) {
          winnerId = pickedUserId;
        } else {
          winnerId = weighted[Math.floor(Math.random() * weighted.length)];
        }
      }

      const winner = await client.users.fetch(winnerId);
      giveaway.ended = true;
      saveData();

      const winnerEmbed = new EmbedBuilder()
        .setTitle('🎉 이벤트 종료 🎉')
        .setDescription(`당첨자: ${winner}\n상품: **${giveaway.prize}**`)
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setTimestamp();

      await interaction.channel.send({ embeds: [winnerEmbed] });

      const giveawayMessage = await interaction.channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (giveawayMessage) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`show_prob_${giveaway.messageId}`)
            .setLabel('📊 확률 보기 (종료됨)')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(false)
        );
        await giveawayMessage.edit({ components: [row] }).catch(() => null);
      }

      return interaction.reply({ content: '이벤트를 종료했습니다.', ephemeral: true });
    }

    // --- weight ---
    else if (subcommand === 'weight') {
      const user = interaction.options.getUser('user');
      const weight = interaction.options.getInteger('weight');
      giveaways.forEach(g => g.weights.set(user.id, weight));
      saveData();
      return interaction.reply({ content: `${user.tag} 가중치 ${weight}로 설정됨.`, ephemeral: true });
    }

    // --- pick ---
    else if (subcommand === 'pick') {
      const user = interaction.options.getUser('user');
      const prob = interaction.options.getNumber('probability');
      giveaways.forEach(g => g.pickedUser = { id: user.id, probability: prob });
      saveData();
      return interaction.reply({ content: `${user.tag}을(를) 픽으로 ${prob}% 확률로 설정했습니다.`, ephemeral: true });
    }
  }

  // ⚙ config
  if (interaction.commandName === 'config') {
    if (!hasPermission(interaction)) {
      return interaction.reply({ content: '이 명령은 관리자 또는 허용된 역할만 사용할 수 있습니다.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    // 제외 역할 추가
    if (subcommand === 'exclude-role-add') {
      const role = interaction.options.getRole('role');
      if (!excludedRoleIds.includes(role.id)) {
        excludedRoleIds.push(role.id);
        saveData();
      }
      return interaction.reply({ content: `${role.name} 역할이 제외 목록에 추가되었습니다.`, ephemeral: true });
    }

    // 제외 역할 제거
    if (subcommand === 'exclude-role-remove') {
      const role = interaction.options.getRole('role');
      excludedRoleIds = excludedRoleIds.filter(r => r !== role.id);
      saveData();
      return interaction.reply({ content: `${role.name} 역할이 제외 목록에서 제거되었습니다.`, ephemeral: true });
    }

    // 제외 역할 목록
    if (subcommand === 'list-excluded') {
      if (excludedRoleIds.length === 0) {
        return interaction.reply({ content: '현재 제외된 역할이 없습니다.', ephemeral: true });
      }
      const roleMentions = excludedRoleIds.map(rid => `<@&${rid}>`).join(', ');
      return interaction.reply({ content: `제외된 역할: ${roleMentions}`, ephemeral: true });
    }

    // 허용 역할 추가
    if (subcommand === 'add-role') {
      const role = interaction.options.getRole('role');
      if (!allowedRoleIds.includes(role.id)) {
        allowedRoleIds.push(role.id);
        saveData();
      }
      return interaction.reply({ content: `${role.name} 역할이 허용 목록에 추가되었습니다.`, ephemeral: true });
    }

    // 허용 역할 제거
    if (subcommand === 'remove-role') {
      const role = interaction.options.getRole('role');
      allowedRoleIds = allowedRoleIds.filter(r => r !== role.id);
      saveData();
      return interaction.reply({ content: `${role.name} 역할이 허용 목록에서 제거되었습니다.`, ephemeral: true });
    }

    // 허용 역할 목록
    if (subcommand === 'list-roles') {
      if (allowedRoleIds.length === 0) {
        return interaction.reply({ content: '현재 허용된 역할이 없습니다.', ephemeral: true });
      }
      const roleMentions = allowedRoleIds.map(rid => `<@&${rid}>`).join(', ');
      return interaction.reply({ content: `허용된 역할: ${roleMentions}`, ephemeral: true });
    }
  }

  // 📊 확률 버튼
  if (interaction.isButton() && interaction.customId.startsWith('show_prob_')) {
    const messageId = interaction.customId.split('_')[2];
    const giveaway = giveaways.get(messageId);
    if (!giveaway) return interaction.reply({ content: '이벤트를 찾을 수 없습니다.', ephemeral: true });

    const participants = await calculateParticipants(interaction, giveaway);
    if (participants.length === 0) return interaction.reply({ content: '응모자가 없습니다.', ephemeral: true });

    const desc = participants.map(p => `<@${p.id}>: ${p.prob}%`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle('📊 당첨 확률')
      .setDescription(desc)
      .setColor(0x00AE86);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(token);
