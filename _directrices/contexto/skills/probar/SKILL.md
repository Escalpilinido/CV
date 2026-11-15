---
name: probar
description: Toda tarea definida deja una prueba, y una prueba que falla se arregla en el código, no en la prueba. Usar al recibir una tarea de programación («hay que hacer que…», «al cambiar X, que también Y»), cuando el prompt cite «probar» o /probar, y al pasar las pruebas.
---

# /probar

Las reglas de pruebas del proyecto (dónde van, cómo se nombran, quién las ejecuta) están en su `AGENTS.md` y mandan sobre esta skill.

1. **Antes de programar:** convertir la tarea en frases comprobables. Cada frase es el nombre de una prueba.
2. **Con el código, la prueba:** cada frase tiene su prueba, nueva o actualizada. Si la tarea cambia un comportamiento que ya tenía prueba, se actualiza esa prueba y se dice cuál; no se añade otra que la contradiga.
3. **Al pasar las pruebas, si alguna falla:**
   - La tarea pedía cambiar ese comportamiento: se actualiza la prueba (paso 2).
   - No lo pedía: el código ha roto algo. Se corrige el código. La prueba no se toca, no se salta y no se afloja.
   - No está claro cuál de las dos: preguntar al usuario.
4. **Cerrar** diciendo las pruebas nuevas, las actualizadas y lo que queda sin ejecutar.
