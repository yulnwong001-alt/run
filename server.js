const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(__dirname));

// 房间存储
const rooms = {};

io.on('connection', (socket) => {
  console.log('玩家连接：', socket.id);

  // 创建/加入房间
  socket.on('joinRoom', (roomId, playerName) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: {},
        finishLine: 100 // 终点距离
      };
    }
    // 初始化玩家
    rooms[roomId].players[socket.id] = {
      name: playerName,
      pos: 0,
      lastKey: null,
      isStun: false,
      win: false
    };
    // 发送房间全部状态给新玩家
    socket.emit('roomState', rooms[roomId].players);
    socket.to(roomId).emit('roomState', rooms[roomId].players);
  });

  // 玩家按键事件
  socket.on('keyPress', (roomId, key) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    if (p.isStun || p.win) return;

    if (key === p.lastKey) {
      // 连续相同按键，摔倒眩晕1秒
      p.isStun = true;
      setTimeout(() => {
        p.isStun = false;
        io.to(roomId).emit('roomState', room.players);
      }, 1000);
    } else {
      // 交替按键，前进
      p.pos += 1;
      p.lastKey = key;
      // 判断到达终点
      if (p.pos >= room.finishLine) {
        p.win = true;
      }
    }
    io.to(roomId).emit('roomState', room.players);
  });

  // 重置本局游戏
  socket.on('resetRace', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    Object.values(room.players).forEach(p => {
      p.pos = 0;
      p.lastKey = null;
      p.isStun = false;
      p.win = false;
    });
    io.to(roomId).emit('roomState', room.players);
  });

  // 玩家断开
  socket.on('disconnect', () => {
    for (const rid in rooms) {
      if (rooms[rid].players[socket.id]) {
        delete rooms[rid].players[socket.id];
        io.to(rid).emit('roomState', rooms[rid].players);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器启动，端口 ${PORT}`);
});
