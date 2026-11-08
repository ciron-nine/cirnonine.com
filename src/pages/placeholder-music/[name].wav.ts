/** 占位背景音乐：构建时生成成静态 WAV 文件，正式曲目上传 R2 后连同这个文件一起删掉 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { PLACEHOLDER_NAMES, placeholderWav, type PlaceholderName } from '../../lib/placeholder-audio';

export const getStaticPaths = (() => PLACEHOLDER_NAMES.map((name) => ({ params: { name } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(placeholderWav(params.name as PlaceholderName), { headers: { 'Content-Type': 'audio/wav' } });
