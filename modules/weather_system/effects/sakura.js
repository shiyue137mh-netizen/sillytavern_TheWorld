/**
 * The World - Sakura (Cherry Blossom) WebGL Effect
 * This module contains the complete, standalone logic for rendering the sakura particle effect.
 */

const Vector3 = {
    create: (x, y, z) => ({'x':x, 'y':y, 'z':z}),
    dot: (v0, v1) => v0.x * v1.x + v0.y * v1.y + v0.z * v1.z,
    cross: (v, v0, v1) => { v.x = v0.y * v1.z - v0.z * v1.y; v.y = v0.z * v1.x - v0.x * v1.z; v.z = v0.x * v1.y - v0.y * v1.x; },
    normalize: (v) => { let l = v.x * v.x + v.y * v.y + v.z * v.z; if(l > 0.00001) { l = 1.0 / Math.sqrt(l); v.x *= l; v.y *= l; v.z *= l; } },
    arrayForm: (v) => { if(!v.array) v.array = new Float32Array(3); v.array[0] = v.x; v.array[1] = v.y; v.array[2] = v.z; return v.array; }
};

const Matrix44 = {
    createIdentity: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
    loadProjection: function(m, aspect, vdeg, near, far) {
        let h = near * Math.tan(vdeg * Math.PI / 180.0 * 0.5) * 2.0;
        let w = h * aspect;
        m[0] = 2.0 * near / w; m[1] = 0; m[2] = 0; m[3] = 0;
        m[4] = 0; m[5] = 2.0 * near / h; m[6] = 0; m[7] = 0;
        m[8] = 0; m[9] = 0; m[10] = -(far + near) / (far - near); m[11] = -1.0;
        m[12] = 0; m[13] = 0; m[14] = -2.0 * far * near / (far - near); m[15] = 0;
    },
    loadLookAt: function(m, vpos, vlook, vup) {
        let frontv = Vector3.create(vpos.x - vlook.x, vpos.y - vlook.y, vpos.z - vlook.z); Vector3.normalize(frontv);
        let sidev = Vector3.create(1,0,0); Vector3.cross(sidev, vup, frontv); Vector3.normalize(sidev);
        let topv = Vector3.create(1,0,0); Vector3.cross(topv, frontv, sidev);
        m[0] = sidev.x; m[1] = topv.x; m[2] = frontv.x; m[3] = 0;
        m[4] = sidev.y; m[5] = topv.y; m[6] = frontv.y; m[7] = 0;
        m[8] = sidev.z; m[9] = topv.z; m[10] = frontv.z; m[11] = 0;
        m[12] = -(vpos.x * m[0] + vpos.y * m[4] + vpos.z * m[8]);
        m[13] = -(vpos.x * m[1] + vpos.y * m[5] + vpos.z * m[9]);
        m[14] = -(vpos.x * m[2] + vpos.y * m[6] + vpos.z * m[10]);
        m[15] = 1;
    }
};

export const SakuraFX = {
    gl: null, canvas: null, animating: false, animationFrameId: null, sceneStandBy: false, _boundResizeHandler: null,
    timeInfo: { 'start': 0, 'prev': 0, 'delta': 0, 'elapsed': 0 }, activeParticles: 0,
    renderSpec: { 'width': 0, 'height': 0, 'aspect': 1, 'array': new Float32Array(3), 'halfWidth': 0, 'halfHeight': 0, 'halfArray': new Float32Array(3), 'pointSize': { 'min': 0, 'max': 0 },
        'setSize': function(w, h) { this.width = w; this.height = h; this.aspect = this.width / this.height; this.array[0] = this.width; this.array[1] = this.height; this.array[2] = this.aspect; this.halfWidth = Math.floor(w / 2); this.halfHeight = Math.floor(h / 2); this.halfArray[0] = this.halfWidth; this.halfArray[1] = this.halfHeight; this.halfArray[2] = this.halfWidth / this.halfHeight; }
    },
    projection: { 'angle': 60, 'nearfar': new Float32Array([0.1, 100.0]), 'matrix': null },
    camera: { 'position': {x: 0, y: 0, z: 100}, 'lookat': {x: 0, y: 0, z: 0}, 'up': {x: 0, y: 1, z: 0}, 'dof': {x: 10.0, y: 4.0, z: 8.0}, 'matrix': null },
    pointFlower: {}, effectLib: {},
    shaders: {
        sakura_point_vsh: `
            uniform mat4 uProjection; uniform mat4 uModelview; uniform vec3 uResolution; uniform vec3 uOffset;
            uniform vec3 uDOF; uniform vec3 uFade; attribute vec3 aPosition; attribute vec3 aEuler;
            attribute vec2 aMisc; varying vec3 pposition; varying float psize; varying float palpha;
            varying float pdist; varying vec3 normX; varying vec3 normY; varying vec3 normZ; varying vec3 normal;
            varying float diffuse; varying float specular; varying float rstop; varying float distancefade;
            void main(void) {
                vec4 pos = uModelview * vec4(aPosition + uOffset, 1.0);
                gl_Position = uProjection * pos;
                gl_PointSize = aMisc.x * uProjection[1][1] / -pos.z * uResolution.y * 0.5;
                pposition = pos.xyz; psize = aMisc.x; pdist = length(pos.xyz);
                palpha = smoothstep(0.0, 1.0, (pdist - 0.1) / uFade.z);
                vec3 elrsn = sin(aEuler); vec3 elrcs = cos(aEuler);
                mat3 rotx = mat3(1.0, 0.0, 0.0, 0.0, elrcs.x, elrsn.x, 0.0, -elrsn.x, elrcs.x);
                mat3 roty = mat3(elrcs.y, 0.0, -elrsn.y, 0.0, 1.0, 0.0, elrsn.y, 0.0, elrcs.y);
                mat3 rotz = mat3(elrcs.z, elrsn.z, 0.0, -elrsn.z, elrcs.z, 0.0, 0.0, 0.0, 1.0);
                mat3 rotmat = rotx * roty * rotz; normal = rotmat[2];
                normX = rotmat[0]; normY = rotmat[1]; normZ = rotmat[2];
                const vec3 lit = vec3(0.6917, 0.6917, -0.2075);
                float tmpdfs = dot(lit, normal);
                if(tmpdfs < 0.0) { normal = -normal; tmpdfs = dot(lit, normal); }
                diffuse = 0.4 + tmpdfs;
                vec3 eyev = normalize(-pos.xyz);
                if(dot(eyev, normal) > 0.0) { vec3 hv = normalize(eyev + lit); specular = pow(max(dot(hv, normal), 0.0), 20.0); }
                else { specular = 0.0; }
                rstop = clamp((abs(pdist - uDOF.x) - uDOF.y) / uDOF.z, 0.0, 1.0);
                rstop = pow(rstop, 0.5);
                distancefade = min(1.0, exp((uFade.x - pdist) * 0.69315 / uFade.y));
            }`,
        sakura_point_fsh: `
            precision highp float;
            uniform vec3 uDOF; uniform vec3 uFade; const vec3 fadeCol = vec3(0.08, 0.03, 0.06);
            varying vec3 pposition; varying float psize; varying float palpha; varying float pdist;
            varying vec3 normX; varying vec3 normY; varying vec3 normZ; varying vec3 normal;
            varying float diffuse; varying float specular; varying float rstop; varying float distancefade;
            float ellipse(vec2 p, vec2 o, vec2 r) { vec2 lp = (p - o) / r; return length(lp) - 1.0; }
            void main(void) {
                vec3 p = vec3(gl_PointCoord - vec2(0.5, 0.5), 0.0) * 2.0;
                vec3 d = vec3(0.0, 0.0, -1.0);
                float nd = normZ.z;
                if(abs(nd) < 0.0001) discard;
                float np = dot(normZ, p); vec3 tp = p + d * np / nd;
                vec2 coord = vec2(dot(normX, tp), dot(normY, tp));
                const float flwrsn = 0.2588; const float flwrcs = 0.9659;
                mat2 flwrm = mat2(flwrcs, -flwrsn, flwrsn, flwrcs);
                vec2 flwrp = vec2(abs(coord.x), coord.y) * flwrm;
                float r;
                if(flwrp.x < 0.0) { r = ellipse(flwrp, vec2(0.065, 0.024) * 0.5, vec2(0.36, 0.96) * 0.5); }
                else { r = ellipse(flwrp, vec2(0.065, 0.024) * 0.5, vec2(0.58, 0.96) * 0.5); }
                if(r > rstop) discard;
                vec3 col = mix(vec3(1.0, 0.8, 0.75), vec3(1.0, 0.9, 0.87), r);
                float grady = mix(0.0, 1.0, pow(coord.y * 0.5 + 0.5, 0.35));
                col *= vec3(1.0, grady, grady);
                col *= mix(0.8, 1.0, pow(abs(coord.x), 0.3));
                col = col * diffuse + specular;
                col = mix(fadeCol, col, distancefade);
                float alpha = (rstop > 0.001)? (0.5 - r / (rstop * 2.0)) : 1.0;
                alpha = smoothstep(0.0, 1.0, alpha) * palpha;
                gl_FragColor = vec4(col * alpha, alpha);
            }`,
        fx_common_vsh: `
            uniform vec3 uResolution; attribute vec2 aPosition; varying vec2 texCoord; varying vec2 screenCoord;
            void main(void) {
                gl_Position = vec4(aPosition, 0.0, 1.0);
                texCoord = aPosition.xy * 0.5 + vec2(0.5, 0.5);
                screenCoord = aPosition.xy * vec2(uResolution.z, 1.0);
            }`,
        pp_final_fsh: `
            precision highp float;
            uniform sampler2D uSrc; uniform sampler2D uBloom; uniform vec2 uDelta;
            varying vec2 texCoord; varying vec2 screenCoord;
            void main(void) {
                vec4 srccol = texture2D(uSrc, texCoord) * 2.0;
                vec4 bloomcol = texture2D(uBloom, texCoord);
                vec4 col = srccol + bloomcol * (vec4(1.0) + srccol);
                col *= smoothstep(1.0, 0.0, pow(length((texCoord - vec2(0.5)) * 2.0), 1.2) * 0.5);
                col = pow(col, vec4(0.454545));
                gl_FragColor = vec4(col.rgb, clamp(srccol.a, 0.0, 1.0));
            }`,
        fx_brightbuf_fsh: `
            precision highp float;
            uniform sampler2D uSrc; varying vec2 texCoord;
            void main(void) {
                vec4 col = texture2D(uSrc, texCoord);
                gl_FragColor = vec4(col.rgb * 2.0 - vec3(0.5), 1.0);
            }`,
        fx_dirblur_r4_fsh: `
            precision highp float;
            uniform sampler2D uSrc; uniform vec2 uDelta; uniform vec4 uBlurDir;
            varying vec2 texCoord;
            void main(void) {
                vec4 col = texture2D(uSrc, texCoord);
                col += texture2D(uSrc, texCoord + uBlurDir.xy * uDelta);
                col += texture2D(uSrc, texCoord - uBlurDir.xy * uDelta);
                col += texture2D(uSrc, texCoord + (uBlurDir.xy + uBlurDir.zw) * uDelta);
                col += texture2D(uSrc, texCoord - (uBlurDir.xy + uBlurDir.zw) * uDelta);
                gl_FragColor = col / 5.0;
            }`,
    },
    
    init: function(canvas) {
        if (!canvas) return;
        this.canvas = canvas;
        try {
            this.gl = this.canvas.getContext('experimental-webgl');
        } catch (e) {
            // Error logging is handled by the calling module (WeatherSystem)
            return;
        }
        setTimeout(() => {
            this.activeParticles = 0;
            this.projection.matrix = Matrix44.createIdentity();
            this.camera.matrix = Matrix44.createIdentity();
            this.onResize();
            this.createScene();
            this.initScene();
            this.timeInfo.start = new Date();
            this.timeInfo.prev = this.timeInfo.start;
            this.animating = true;
            this._boundResizeHandler = this.onResize.bind(this);
            window.addEventListener('resize', this._boundResizeHandler);
            this.animate();
        }, 50);
    },

    stop: function() {
        this.animating = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this._boundResizeHandler) {
            window.removeEventListener('resize', this._boundResizeHandler);
            this._boundResizeHandler = null;
        }
        if (this.gl) {
            Object.values(this.effectLib).forEach(eff => {
                if (eff && eff.program) this.gl.deleteProgram(eff.program);
                if (eff && eff.buffer) this.gl.deleteBuffer(eff.buffer);
            });
            if (this.pointFlower.program) this.gl.deleteProgram(this.pointFlower.program);
            if (this.pointFlower.buffer) this.gl.deleteBuffer(this.pointFlower.buffer);
            try {
                const loseContext = this.gl.getExtension('WEBGL_lose_context');
                if (loseContext) loseContext.loseContext();
            } catch (e) {}
        }
        if (this.canvas) {
            this.canvas.remove();
        }
    },

    animate: function() {
        if (!this.animating) return;
        let curdate = new Date();
        this.timeInfo.elapsed = (curdate - this.timeInfo.start) / 1000.0;
        this.timeInfo.delta = (curdate - this.timeInfo.prev) / 1000.0;
        this.timeInfo.prev = curdate;
        if (this.activeParticles < this.pointFlower.numFlowers) {
            this.activeParticles += this.pointFlower.activationRate * this.timeInfo.delta;
            if (this.activeParticles > this.pointFlower.numFlowers) {
                this.activeParticles = this.pointFlower.numFlowers;
            }
        }
        this.renderScene();
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    },

    onResize: function() {
        if (!this.canvas || !this.gl) return;
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
        }
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            setTimeout(() => this.onResize(), 100);
            return;
        }
        this.setViewports();
        if (this.sceneStandBy) this.initScene();
    },

    setViewports: function() {
        if (this.gl.canvas.width === 0 || this.gl.canvas.height === 0) return;
        this.renderSpec.setSize(this.gl.canvas.width, this.gl.canvas.height);
        this.gl.viewport(0, 0, this.renderSpec.width, this.renderSpec.height);
        const rtfunc = (rtname, rtw, rth) => {
            let rt = this.renderSpec[rtname];
            if (rt) this.deleteRenderTarget(rt);
            this.renderSpec[rtname] = this.createRenderTarget(rtw, rth);
        };
        rtfunc('mainRT', this.renderSpec.width, this.renderSpec.height);
        rtfunc('wHalfRT0', this.renderSpec.halfWidth, this.renderSpec.halfHeight);
        rtfunc('wHalfRT1', this.renderSpec.halfWidth, this.renderSpec.halfHeight);
    },

    createScene: function() { this.createEffectLib(); this.createPointFlowers(); this.sceneStandBy = true; },
    initScene: function() {
        this.initPointFlowers();
        this.camera.position.z = this.pointFlower.area.z + this.projection.nearfar[0];
        this.projection.angle = Math.atan2(this.pointFlower.area.y, this.camera.position.z + this.pointFlower.area.z) * 180.0 / Math.PI * 2.0;
        Matrix44.loadProjection(this.projection.matrix, this.renderSpec.aspect, this.projection.angle, this.projection.nearfar[0], this.projection.nearfar[1]);
    },
    renderScene: function() {
        if (this.gl.canvas.width === 0 || this.gl.canvas.height === 0) return;
        Matrix44.loadLookAt(this.camera.matrix, this.camera.position, this.camera.lookat, this.camera.up);
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderSpec.mainRT.frameBuffer);
        gl.viewport(0, 0, this.renderSpec.mainRT.width, this.renderSpec.mainRT.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.renderPointFlowers();
        this.renderPostProcess();
    },
    renderPointFlowers: function() {
        const gl = this.gl; const PI2 = Math.PI * 2.0; const limit = [this.pointFlower.area.x, this.pointFlower.area.y, this.pointFlower.area.z]; const symmetryrand = () => Math.random() * 2.0 - 1.0; const activeCount = Math.floor(this.activeParticles);
        for(let i = 0; i < activeCount; i++) {
            let prtcl = this.pointFlower.particles[i]; prtcl.update(this.timeInfo.delta, this.timeInfo.elapsed);
            if(Math.abs(prtcl.position[0]) - prtcl.size * 0.5 > limit[0]) { prtcl.position[0] > 0 ? prtcl.position[0] -= limit[0] * 2.0 : prtcl.position[0] += limit[0] * 2.0; }
            if(prtcl.position[1] < -limit[1]) { prtcl.position[1] = limit[1] + Math.random() * 5.0; prtcl.position[0] = symmetryrand() * limit[0]; }
            if(Math.abs(prtcl.position[2]) - prtcl.size * 0.5 > limit[2]) { prtcl.position[2] > 0 ? prtcl.position[2] -= limit[2] * 2.0 : prtcl.position[2] += limit[2] * 2.0; }
            prtcl.euler[0] = (prtcl.euler[0] % PI2 + PI2) % PI2; prtcl.euler[1] = (prtcl.euler[1] % PI2 + PI2) % PI2; prtcl.euler[2] = (prtcl.euler[2] % PI2 + PI2) % PI2;
            prtcl.zkey = (this.camera.matrix[2] * prtcl.position[0] + this.camera.matrix[6] * prtcl.position[1] + this.camera.matrix[10] * prtcl.position[2] + this.camera.matrix[14]);
        }
        this.pointFlower.particles.sort((p0, p1) => p0.zkey - p1.zkey);
        let ipos = 0, ieuler = this.pointFlower.numFlowers * 3, imisc = this.pointFlower.numFlowers * 6;
        for(let i = 0; i < this.pointFlower.numFlowers; i++) {
            let prtcl = this.pointFlower.particles[i];
            this.pointFlower.dataArray[ipos++] = prtcl.position[0]; this.pointFlower.dataArray[ipos++] = prtcl.position[1]; this.pointFlower.dataArray[ipos++] = prtcl.position[2];
            this.pointFlower.dataArray[ieuler++] = prtcl.euler[0]; this.pointFlower.dataArray[ieuler++] = prtcl.euler[1]; this.pointFlower.dataArray[ieuler++] = prtcl.euler[2];
            this.pointFlower.dataArray[imisc++] = prtcl.size; this.pointFlower.dataArray[imisc++] = 1.0;
        }
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const prog = this.pointFlower.program; this.useShader(prog);
        gl.uniformMatrix4fv(prog.uniforms.uProjection, false, this.projection.matrix); gl.uniformMatrix4fv(prog.uniforms.uModelview, false, this.camera.matrix);
        gl.uniform3fv(prog.uniforms.uResolution, this.renderSpec.array); gl.uniform3fv(prog.uniforms.uDOF, Vector3.arrayForm(this.camera.dof)); gl.uniform3fv(prog.uniforms.uFade, Vector3.arrayForm(this.pointFlower.fader));
        gl.bindBuffer(gl.ARRAY_BUFFER, this.pointFlower.buffer); gl.bufferData(gl.ARRAY_BUFFER, this.pointFlower.dataArray, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(prog.attributes.aPosition, 3, gl.FLOAT, false, 0, 0); gl.vertexAttribPointer(prog.attributes.aEuler, 3, gl.FLOAT, false, 0, this.pointFlower.numFlowers * 3 * 4); gl.vertexAttribPointer(prog.attributes.aMisc, 2, gl.FLOAT, false, 0, this.pointFlower.numFlowers * 6 * 4);
        const zpos = -2.0;
        this.pointFlower.offset[0] = this.pointFlower.area.x * -1.0; this.pointFlower.offset[1] = this.pointFlower.area.y * -1.0; this.pointFlower.offset[2] = this.pointFlower.area.z * zpos; gl.uniform3fv(prog.uniforms.uOffset, this.pointFlower.offset); gl.drawArrays(gl.POINT, 0, activeCount);
        this.pointFlower.offset[0] = this.pointFlower.area.x * -1.0; this.pointFlower.offset[1] = this.pointFlower.area.y * 1.0; this.pointFlower.offset[2] = this.pointFlower.area.z * zpos; gl.uniform3fv(prog.uniforms.uOffset, this.pointFlower.offset); gl.drawArrays(gl.POINT, 0, activeCount);
        this.pointFlower.offset[0] = this.pointFlower.area.x * 1.0; this.pointFlower.offset[1] = this.pointFlower.area.y * -1.0; this.pointFlower.offset[2] = this.pointFlower.area.z * zpos; gl.uniform3fv(prog.uniforms.uOffset, this.pointFlower.offset); gl.drawArrays(gl.POINT, 0, activeCount);
        this.pointFlower.offset[0] = this.pointFlower.area.x * 1.0; this.pointFlower.offset[1] = this.pointFlower.area.y * 1.0; this.pointFlower.offset[2] = this.pointFlower.area.z * zpos; gl.uniform3fv(prog.uniforms.uOffset, this.pointFlower.offset); gl.drawArrays(gl.POINT, 0, activeCount);
        this.pointFlower.offset[0] = 0.0; this.pointFlower.offset[1] = 0.0; this.pointFlower.offset[2] = 0.0; gl.uniform3fv(prog.uniforms.uOffset, this.pointFlower.offset); gl.drawArrays(gl.POINT, 0, activeCount);
        gl.bindBuffer(gl.ARRAY_BUFFER, null); this.unuseShader(prog); gl.disable(gl.BLEND);
    },
    renderPostProcess: function() {
        const gl = this.gl; gl.disable(gl.DEPTH_TEST);
        const bindRT = (rt, isclear) => { gl.bindFramebuffer(gl.FRAMEBUFFER, rt.frameBuffer); gl.viewport(0, 0, rt.width, rt.height); if(isclear) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); } };
        bindRT(this.renderSpec.wHalfRT0, true); this.useEffect(this.effectLib.mkBrightBuf, this.renderSpec.mainRT); this.drawEffect(this.effectLib.mkBrightBuf);
        for(let i = 0; i < 2; i++) {
            let p = 1.5 + i, s = 2.0 + i;
            bindRT(this.renderSpec.wHalfRT1, true); this.useEffect(this.effectLib.dirBlur, this.renderSpec.wHalfRT0); gl.uniform4f(this.effectLib.dirBlur.program.uniforms.uBlurDir, p, 0.0, s, 0.0); this.drawEffect(this.effectLib.dirBlur);
            bindRT(this.renderSpec.wHalfRT0, true); this.useEffect(this.effectLib.dirBlur, this.renderSpec.wHalfRT1); gl.uniform4f(this.effectLib.dirBlur.program.uniforms.uBlurDir, 0.0, p, 0.0, s); this.drawEffect(this.effectLib.dirBlur);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.renderSpec.width, this.renderSpec.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.useEffect(this.effectLib.finalComp, this.renderSpec.mainRT); gl.uniform1i(this.effectLib.finalComp.program.uniforms.uBloom, 1); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.renderSpec.wHalfRT0.texture); this.drawEffect(this.effectLib.finalComp); gl.enable(gl.DEPTH_TEST);
    },
    createPointFlowers: function() {
        this.renderSpec.pointSize = this.gl.getParameter(this.gl.ALIASED_POINT_SIZE_RANGE);
        this.pointFlower.program = this.createShader(this.shaders.sakura_point_vsh, this.shaders.sakura_point_fsh, ['uProjection', 'uModelview', 'uResolution', 'uOffset', 'uDOF', 'uFade'], ['aPosition', 'aEuler', 'aMisc']);
        this.useShader(this.pointFlower.program);
        this.pointFlower.offset = new Float32Array([0, 0, 0]); this.pointFlower.fader = Vector3.create(0.0, 10.0, 0.0);
        this.pointFlower.numFlowers = 500; this.pointFlower.activationRate = 30; this.pointFlower.particles = new Array(this.pointFlower.numFlowers);
        this.pointFlower.dataArray = new Float32Array(this.pointFlower.numFlowers * (3 + 3 + 2)); this.pointFlower.buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointFlower.buffer); this.gl.bufferData(this.gl.ARRAY_BUFFER, this.pointFlower.dataArray, this.gl.DYNAMIC_DRAW); this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); this.unuseShader(this.pointFlower.program);
        const BlossomParticle = function(){ this.velocity=[0,0,0]; this.rotation=[0,0,0]; this.position=[0,0,0]; this.euler=[0,0,0]; this.size=1.0; };
        BlossomParticle.prototype.update = function(dt, et){ this.position[0]+=this.velocity[0]*dt; this.position[1]+=this.velocity[1]*dt; this.position[2]+=this.velocity[2]*dt; this.euler[0]+=this.rotation[0]*dt; this.euler[1]+=this.rotation[1]*dt; this.euler[2]+=this.rotation[2]*dt; };
        for(let i = 0; i < this.pointFlower.numFlowers; i++) this.pointFlower.particles[i] = new BlossomParticle();
    },
    initPointFlowers: function() {
        this.pointFlower.area = Vector3.create(20.0, 20.0, 20.0); this.pointFlower.area.x = this.pointFlower.area.y * this.renderSpec.aspect;
        this.pointFlower.fader.x = 10.0; this.pointFlower.fader.y = this.pointFlower.area.z; this.pointFlower.fader.z = 0.1;
        const PI2 = Math.PI * 2.0, symmetryrand = () => Math.random() * 2.0 - 1.0; const windStrength = 1.5;
        for(let i = 0; i < this.pointFlower.numFlowers; i++) {
            let p = this.pointFlower.particles[i]; let vy = -(Math.random() * 1.0 + 0.5); let vx = (symmetryrand() * 0.7) + windStrength; let vz = symmetryrand() * 0.5;
            let v = Vector3.create(vx, vy, vz); Vector3.normalize(v); let s = 1.5 + Math.random(); p.velocity = [v.x*s, v.y*s, v.z*s];
            const rotationSpeedFactor = 1.5; p.rotation = [symmetryrand()*PI2*0.5*rotationSpeedFactor, symmetryrand()*PI2*0.5*rotationSpeedFactor, symmetryrand()*PI2*0.5*rotationSpeedFactor];
            p.position = [symmetryrand()*this.pointFlower.area.x, symmetryrand()*this.pointFlower.area.y, symmetryrand()*this.pointFlower.area.z]; p.euler = [Math.random()*PI2, Math.random()*PI2, Math.random()*PI2];
            p.size = 0.9 + Math.random() * 0.1;
        }
    },
    createEffectLib: function() {
        const cmnvtxsrc = this.shaders.fx_common_vsh;
        this.effectLib.mkBrightBuf = this.createEffectProgram(cmnvtxsrc, this.shaders.fx_brightbuf_fsh); this.effectLib.dirBlur = this.createEffectProgram(cmnvtxsrc, this.shaders.fx_dirblur_r4_fsh, ['uBlurDir']); this.effectLib.finalComp = this.createEffectProgram(cmnvtxsrc, this.shaders.pp_final_fsh, ['uBloom']);
    },
    createEffectProgram: function(vtxsrc, frgsrc, exunifs, exattrs) {
        let ret = {}; let unifs = ['uResolution', 'uSrc', 'uDelta']; if(exunifs) unifs = unifs.concat(exunifs); let attrs = ['aPosition']; if(exattrs) attrs = attrs.concat(exattrs);
        ret.program = this.createShader(vtxsrc, frgsrc, unifs, attrs); if (!ret.program) return null;
        this.useShader(ret.program); ret.dataArray = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]); ret.buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, ret.buffer); this.gl.bufferData(this.gl.ARRAY_BUFFER, ret.dataArray, this.gl.STATIC_DRAW); this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); this.unuseShader(ret.program); return ret;
    },
    useEffect: function(fxobj, srctex) {
        if (!fxobj || !fxobj.program) return; const prog = fxobj.program; this.useShader(prog); this.gl.uniform3fv(prog.uniforms.uResolution, this.renderSpec.array);
        if(srctex != null) { this.gl.uniform2fv(prog.uniforms.uDelta, srctex.dtxArray); this.gl.uniform1i(prog.uniforms.uSrc, 0); this.gl.activeTexture(this.gl.TEXTURE0); this.gl.bindTexture(this.gl.TEXTURE_2D, srctex.texture); }
    },
    drawEffect: function(fxobj) { if (!fxobj || !fxobj.program) return; this.gl.bindBuffer(this.gl.ARRAY_BUFFER, fxobj.buffer); this.gl.vertexAttribPointer(fxobj.program.attributes.aPosition, 2, this.gl.FLOAT, false, 0, 0); this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4); },
    createRenderTarget: function(w, h) {
        const gl = this.gl; let ret = { 'width':w, 'height':h, 'dtxArray':new Float32Array([1/w, 1/h]) }; ret.frameBuffer = gl.createFramebuffer(); ret.renderBuffer = gl.createRenderbuffer(); ret.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, ret.texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.bindFramebuffer(gl.FRAMEBUFFER, ret.frameBuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ret.texture, 0); gl.bindRenderbuffer(gl.RENDERBUFFER, ret.renderBuffer); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ret.renderBuffer);
        gl.bindTexture(gl.TEXTURE_2D, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return ret;
    },
    deleteRenderTarget: function(rt) { if (!rt || !this.gl) return; this.gl.deleteFramebuffer(rt.frameBuffer); this.gl.deleteRenderbuffer(rt.renderBuffer); this.gl.deleteTexture(rt.texture); },
    createShader: function(vtxsrc, frgsrc, uniformlist, attrlist) {
        const vsh = this.compileShader(this.gl.VERTEX_SHADER, vtxsrc); const fsh = this.compileShader(this.gl.FRAGMENT_SHADER, frgsrc); if(!vsh || !fsh) return null;
        const prog = this.gl.createProgram(); this.gl.attachShader(prog, vsh); this.gl.attachShader(prog, fsh); this.gl.deleteShader(vsh); this.gl.deleteShader(fsh); this.gl.linkProgram(prog);
        if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) { this.gl.deleteProgram(prog); return null; }
        if(uniformlist) { prog.uniforms = {}; uniformlist.forEach(u => { prog.uniforms[u] = this.gl.getUniformLocation(prog, u); }); }
        if(attrlist) { prog.attributes = {}; attrlist.forEach(a => { prog.attributes[a] = this.gl.getAttribLocation(prog, a); }); }
        return prog;
    },
    compileShader: function(shtype, shsrc) {
        if (shsrc === undefined) { return null; }
        const retsh = this.gl.createShader(shtype); this.gl.shaderSource(retsh, shsrc); this.gl.compileShader(retsh);
        if (!this.gl.getShaderParameter(retsh, this.gl.COMPILE_STATUS)) { this.gl.deleteShader(retsh); return null; }
        return retsh;
    },
    useShader: function(prog) { if (!prog) return; this.gl.useProgram(prog); if (!prog.attributes) return; for(let attr in prog.attributes) { this.gl.enableVertexAttribArray(prog.attributes[attr]); } },
    unuseShader: function(prog) { if (!prog) return; if (!prog.attributes) return; for(let attr in prog.attributes) { this.gl.disableVertexAttribArray(prog.attributes[attr]); } this.gl.useProgram(null); }
};