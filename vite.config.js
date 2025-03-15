import viteImagemin from '@vheemstra/vite-plugin-imagemin'
import autoprefixer from 'autoprefixer'
import fs from 'fs'
import imageminMozjpeg from 'imagemin-mozjpeg'
import imageminPngquant from 'imagemin-pngquant'
import imageminSvgo from 'imagemin-svgo'
import imageminWebp from 'imagemin-webp'
import path from 'path'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'

function replaceImageUrls() {
	return {
		name: 'replace-image-urls',
		apply: 'build',
		enforce: 'post',
		generateBundle(_, bundle) {
			for (const [fileName, file] of Object.entries(bundle)) {
				if (fileName.endsWith('.css')) {
					let css = file.source
					css = css.replace(/url\((\/assets\/[\w-]+\.(jpg|jpeg|png))\)/g, (match, p1, p2) => {
						const webpUrl = p1 + '.webp'
						const imageType = p2 === 'jpg' ? 'jpeg' : p2
						return `image-set(url(${webpUrl}) type("image/webp"), url(${p1}) type("image/${imageType}"))`
					})
					file.source = css
				}
				if (fileName.endsWith('.html')) {
					let html = file.source
					html = html.replace(
						/<img\s+([^>]*?)src="(\/assets\/[\w-]+\.(jpg|jpeg|png))"([^>]*)\/?>/g,
						(match, beforeSrc, src, ext, afterSrc) => {
							const webpUrl = src + '.webp'
							const imageType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
							return `<picture><source srcset="${webpUrl}" type="image/webp" /><img src="${src}" ${beforeSrc.trim()} ${afterSrc.trim()} type="${imageType}" /></picture>`
						}
					)
					file.source = html
				}
			}
		}
	}
}

function watchHtml() {
	return {
		name: 'watch-html',
		apply: 'serve',
		configureServer({ watcher, ws }) {
			watcher.add(path.resolve(__dirname, './src/html/**/*.html'))

			watcher.on('change', file => {
				if (file.endsWith('.html')) {
					ws.send({
						type: 'full-reload'
					})
				}
			})
		}
	}
}

export default defineConfig(({ command, isPreview }) => {
	return {
		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src'),
				'@img': path.resolve(__dirname, './src/img')
			}
		},
		css: {
			preprocessorOptions: {
				scss: {
					api: 'modern-compiler'
				}
			},
			postcss: {
				plugins: [autoprefixer()]
			}
		},
		plugins: [
			viteImagemin({
				plugins: {
					jpg: imageminMozjpeg({
						quality: 85
					}),
					png: imageminPngquant({
						quality: [0.5, 0.85]
					}),
					svg: imageminSvgo({
						plugins: [
							{
								name: 'preset-default',
								params: {
									overrides: {
										removeViewBox: false
									}
								}
							}
						]
					})
				},
				makeWebp: {
					plugins: {
						jpg: imageminWebp(),
						png: imageminWebp()
					}
				}
			}),
			watchHtml(),
			createHtmlPlugin({
				inject: {
					data: {
						getHead({ title = 'Главная', description = '' }) {
							let headTemplate = fs.readFileSync(path.resolve(__dirname, './src/html/head.html'), 'utf-8')
							headTemplate = headTemplate.replace('{{title}}', title).replace('{{description}}', description)

							return headTemplate
						},
						getHeader() {
							return fs.readFileSync(path.resolve(__dirname, './src/html/header.html'), 'utf-8')
						},
						getFooter() {
							return fs.readFileSync(path.resolve(__dirname, './src/html/footer.html'), 'utf-8')
						}
					}
				}
			}),
			replaceImageUrls()
		]
	}
})
