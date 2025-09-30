export async function stopEvent() {
	console.log('Server is stopping...')

	// 這邊放需要關閉的東西，比如資料庫連線、背景工作等

	setTimeout(() => {
		console.log('Good Bye~')
		process.exit()
	}, 1000)
}