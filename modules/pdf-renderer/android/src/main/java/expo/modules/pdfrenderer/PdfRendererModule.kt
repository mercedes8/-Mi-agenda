package expo.modules.pdfrenderer

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

/**
 * Módulo mínimo para la agenda:
 *  - cuenta las páginas de un PDF
 *  - convierte una página en imagen JPG (para dibujar encima)
 *  - arma un PDF nuevo a partir de imágenes (para exportar el PDF anotado)
 */
class PdfRendererModule : Module() {

  private fun toPath(uri: String): String =
    if (uri.startsWith("file://")) Uri.parse(uri).path ?: uri.removePrefix("file://") else uri

  private fun open(uri: String): ParcelFileDescriptor {
    val u = Uri.parse(uri)
    if (u.scheme == "content") {
      val ctx = appContext.reactContext ?: throw CodedException("Sin contexto de Android")
      return ctx.contentResolver.openFileDescriptor(u, "r") ?: throw CodedException("No se pudo abrir el PDF")
    }
    return ParcelFileDescriptor.open(File(toPath(uri)), ParcelFileDescriptor.MODE_READ_ONLY)
  }

  override fun definition() = ModuleDefinition {
    Name("PdfRenderer")

    AsyncFunction("getPageCount") { uri: String ->
      val pfd = open(uri)
      try {
        val renderer = PdfRenderer(pfd)
        val n = renderer.pageCount
        renderer.close()
        n
      } finally {
        pfd.close()
      }
    }

    AsyncFunction("renderPage") { uri: String, page: Int, width: Int, outUri: String ->
      val pfd = open(uri)
      try {
        val renderer = PdfRenderer(pfd)
        try {
          val p = renderer.openPage(page)
          val scale = width.toFloat() / p.width.toFloat()
          val height = (p.height * scale).toInt().coerceAtLeast(1)
          val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
          bmp.eraseColor(Color.WHITE)
          p.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
          p.close()
          val out = File(toPath(outUri))
          out.parentFile?.mkdirs()
          FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.JPEG, 90, it) }
          bmp.recycle()
          mapOf("uri" to Uri.fromFile(out).toString(), "width" to width, "height" to height)
        } finally {
          renderer.close()
        }
      } finally {
        pfd.close()
      }
    }

    AsyncFunction("imagesToPdf") { images: List<String>, outUri: String ->
      val doc = PdfDocument()
      try {
        images.forEachIndexed { i, img ->
          val bmp = BitmapFactory.decodeFile(toPath(img)) ?: throw CodedException("No se pudo leer la página ${i + 1}")
          val info = PdfDocument.PageInfo.Builder(bmp.width, bmp.height, i + 1).create()
          val page = doc.startPage(info)
          page.canvas.drawBitmap(bmp, 0f, 0f, null)
          doc.finishPage(page)
          bmp.recycle()
        }
        val out = File(toPath(outUri))
        out.parentFile?.mkdirs()
        FileOutputStream(out).use { doc.writeTo(it) }
        Uri.fromFile(out).toString()
      } finally {
        doc.close()
      }
    }
  }
}
