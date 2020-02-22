'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var imagemin = require('gulp-imagemin');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var log = require('gulplog');
var babel = require('gulp-babel');
var concat = require('gulp-concat');
var clean = require('gulp-clean');

///////////////////////////////////////////////////////////////////////////////

gulp.task('clean', function() {
    return gulp.src(["htdocs/*.html", "htdocs/js/*.js", "htdocs/js/*.map"],
                    {read: false}).pipe(clean());
});

///////////////////////////////////////////////////////////////////////////////

gulp.task('copyHtml', function copyHtml(cb) {
    gulp.src('src/*.html').pipe(gulp.dest('htdocs'));
    cb();
});

gulp.task('copyMisc', function copyMisc(cb) {
    gulp.src('src/img/*').pipe(gulp.dest('htdocs/img'));
    gulp.src('src/favicon/*').pipe(gulp.dest('htdocs/favicon'));
    gulp.src('src/css/*').pipe(gulp.dest('htdocs/css'));
    cb();
});

///////////////////////////////////////////////////////////////////////////////

gulp.task('imageMin', function imageMin(cb) {
    gulp.src('src/img/*').pipe(imagemin()).pipe(gulp.dest('htdocs/img'));
    cb();
});

///////////////////////////////////////////////////////////////////////////////

gulp.task('javascriptFull', function () {
    var b = browserify({
      entries: './src/js/app.js',
      debug: true
    });

    return b.bundle()
      .pipe(source('./app.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true}))
      .pipe(babel({
          presets: ['@babel/env']
      }))
      .pipe(uglify())
      .on('error', log.error)
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./htdocs/js/'));
});

gulp.task('javascriptQuick', function () {
    var b = browserify({
      entries: './src/js/app.js',
      debug: true
    });

    return b.bundle()
      .pipe(source('./app.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true}))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./htdocs/js/'));
});

///////////////////////////////////////////////////////////////////////////////

gulp.task('full', gulp.series(['copyHtml',
                               'copyMisc',
                               'imageMin',
                               'javascriptFull',
                               'clean',
                               ]));

gulp.task('full_watch', function () {
    gulp.watch("src/**/*" , { ignoreInitial: false },
               gulp.series(['clean',
                            'copyMisc',
                            'imageMin',
                            'javascriptFull',
                            'copyHtml',
                            ]));
});

gulp.task('quick', gulp.series(['clean',
                                'copyMisc',
                                'javascriptQuick',
                                'copyHtml',
                               ]));

gulp.task('quick_watch', function () {
    gulp.watch("src/**/*" , { ignoreInitial: false },
               gulp.series(['clean',
                            'copyMisc',
                            'javascriptQuick',
                            'copyHtml',
                            ]));
});
